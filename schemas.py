from pydantic import BaseModel
from typing import Optional, List, TypedDict



# ── LangGraph State ───────────────────────────────────────────────────────────
class OrchestratorState(TypedDict):
    user_input: str
    role: str
    task_type: str
    data_sensitivity: str
    intent: str
    industry: str
    recommended_tool: str
    tool_reason: str
    tool_confidence: str
    tool_alternatives: List[str]
    tool_alternative_reasons: List[str]
    tool_alternative_confidence_pcts: List[int]
    tool_confidence_pct: int
    tool_confidence_explanation: str
    policy_flags: List[str]
    policies: List[str]
    policy_summary: str          # human-readable policy explanation
    policy_blocked: bool         # True if the task is blocked by policy
    corlo_prompt: str
    prompt_version: str
    llm_output: str
    token_estimate: int
    error: Optional[str]


# ── Request / Response Models ─────────────────────────────────────────────────
class RunRequest(BaseModel):
    user_input: str
    role: Optional[str] = "general"
    task_type: Optional[str] = "general"
    data_sensitivity: Optional[str] = "general"


class FeedbackRequest(BaseModel):
    audit_id:   Optional[str] = ""
    email:      Optional[str] = ""
    rating:     int
    comment:    Optional[str] = ""
    issue_type: Optional[str] = ""
    source:     Optional[str] = "form"


class PromptVersionRequest(BaseModel):
    intent:      Optional[str] = "general"
    industry:    Optional[str] = "general"
    template:    str
    change_note: Optional[str] = ""


class RefinementRequest(BaseModel):
    audit_id:         str
    user_input:       str           # the original question the user asked
    corlo_prompt:     str           # the full CORLO prompt used to generate the response
    llm_output:       str           # the previous AI response being revised
    comment:          str           # what the user wants changed / added / focused on
    role:             Optional[str] = "general"
    task_type:        Optional[str] = "general"
    data_sensitivity: Optional[str] = "general"
    intent:           Optional[str] = "general"
    industry:         Optional[str] = "general"
    recommended_tool: Optional[str] = ""


class AuditUpdateRequest(BaseModel):
    raw_input:   Optional[str] = None
    final_prompt: Optional[str] = None
    output:      Optional[str] = None


class ClarifyRequest(BaseModel):
    user_input:  str
    role:        Optional[str] = "general"
    task_type:   Optional[str] = "general"


class ClarifyAnswerRequest(BaseModel):
    user_input:       str
    role:             Optional[str] = "general"
    task_type:        Optional[str] = "general"
    questions:        List[str]
    answers:          List[str]