import logging
import os
import uuid
from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, HTTPException
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_groq import ChatGroq
from pydantic import BaseModel
from sqlalchemy import func

from db import SessionLocal
from models import ChatMessage, ChatThread
from prompt import SYSTEM_PROMPT
from tools import build_tools

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    uuid: Optional[str] = None


class ChatResponse(BaseModel):
    uuid: str
    reply: str


class ChatMessageOut(BaseModel):
    id: int
    uuid: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSummaryOut(BaseModel):
    uuid: str
    created_at: datetime
    modified_at: datetime


def mcp_url_or_raise() -> str:
    mcp_url = os.getenv("MCP_URL")
    if not mcp_url:
        raise HTTPException(status_code=500, detail="MCP_URL is not set")
    return mcp_url.rstrip("/")


def load_history(chat_uuid: str) -> list[dict[str, Any]]:
    db = SessionLocal()
    try:
        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.uuid == chat_uuid)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        return [{"role": m.role, "content": m.content} for m in messages]
    finally:
        db.close()


def save_message(chat_uuid: str, role: str, content: str) -> None:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        thread = db.query(ChatThread).filter(ChatThread.uuid == chat_uuid).first()
        if not thread:
            thread = ChatThread(
                uuid=chat_uuid,
                created_at=now,
                updated_at=now,
            )
            db.add(thread)
        else:
            thread.updated_at = now
        message = ChatMessage(uuid=chat_uuid, role=role, content=content)
        db.add(message)
        db.commit()
    finally:
        db.close()


@router.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    mcp_url = mcp_url_or_raise()
    tools = build_tools(mcp_url)
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not set")
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    llm = ChatGroq(model=model, groq_api_key=api_key)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder("agent_scratchpad"),
        ]
    )
    agent = create_tool_calling_agent(llm, tools, prompt)
    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=False,
        handle_parsing_errors=True,
    )

    chat_uuid = request.uuid or str(uuid.uuid4())

    save_message(chat_uuid, "user", request.message)
    logger.info(
        "agent_request chat_uuid=%s message=%s",
        chat_uuid,
        request.message,
    )
    history = load_history(chat_uuid)
    history_msgs = []
    for msg in history[1:]:
        if msg["role"] == "assistant":
            history_msgs.append(AIMessage(content=msg["content"]))
        elif msg["role"] == "user":
            history_msgs.append(HumanMessage(content=msg["content"]))

    reply = ""
    for attempt in range(3):
        try:
            # If failing, try to append a hint to be sequential on retries
            current_input = request.message
            if attempt > 0:
                current_input += (
                    " (Please execute tools one by one sequentially to avoid errors.)"
                )

            result = executor.invoke(
                {"input": current_input, "chat_history": history_msgs}
            )
            reply = result.get("output", "")
            break
        except Exception as exc:
            # Catch all exceptions including Groq BadRequestError and TypeError
            logger.exception("agent_error attempt=%s", attempt + 1, exc_info=exc)
            if attempt == 2:
                reply = (
                    "I ran into an error processing your request. "
                    "Please try asking to do one thing at a time."
                )

    save_message(chat_uuid, "assistant", reply)
    logger.info("agent_reply chat_uuid=%s reply=%s", chat_uuid, reply)

    return ChatResponse(uuid=chat_uuid, reply=reply)


@router.get("/api/chat")
def list_or_get_chat(uuid: Optional[str] = None) -> Any:
    db = SessionLocal()
    try:
        if uuid:
            return [
                ChatMessageOut.model_validate(row).model_dump()
                for row in (
                    db.query(ChatMessage)
                    .filter(ChatMessage.uuid == uuid)
                    .order_by(ChatMessage.created_at.asc())
                    .all()
                )
            ]
        existing_threads = {row.uuid for row in db.query(ChatThread.uuid).all()}
        aggregates = (
            db.query(
                ChatMessage.uuid,
                func.min(ChatMessage.created_at).label("created_at"),
                func.max(ChatMessage.created_at).label("updated_at"),
            )
            .group_by(ChatMessage.uuid)
            .all()
        )
        for row in aggregates:
            if row.uuid not in existing_threads:
                db.add(
                    ChatThread(
                        uuid=row.uuid,
                        created_at=row.created_at,
                        updated_at=row.updated_at,
                    )
                )
            else:
                db.query(ChatThread).filter(ChatThread.uuid == row.uuid).update(
                    {
                        ChatThread.created_at: func.least(
                            ChatThread.created_at,
                            row.created_at,
                        ),
                        ChatThread.updated_at: func.greatest(
                            ChatThread.updated_at,
                            row.updated_at,
                        ),
                    }
                )
        db.commit()
        threads = db.query(ChatThread).order_by(ChatThread.updated_at.desc()).all()
        return [
            ChatSummaryOut(
                uuid=row.uuid,
                created_at=row.created_at,
                modified_at=row.updated_at,
            ).model_dump()
            for row in threads
        ]
    finally:
        db.close()


@router.delete("/api/chat/{uuid}")
def delete_chat(uuid: str):
    db = SessionLocal()
    try:
        count = db.query(ChatMessage).filter(ChatMessage.uuid == uuid).delete()
        thread = db.query(ChatThread).filter(ChatThread.uuid == uuid).first()
        if thread:
            db.delete(thread)
        db.commit()
        if count == 0 and not thread:
            raise HTTPException(status_code=404, detail="Not found")
        return {"deleted": count}
    finally:
        db.close()
