"""
LLM Service – AI Mechanic
──────────────────────────
Handles prompt engineering and structured output calls to OpenAI or Gemini.
Always returns a validated DiagnosticResult (never raw text).
"""

from __future__ import annotations

import json
import logging
from app.config import get_settings
from app.schemas.diagnostics import DiagnosticResult, PreventionTipsResult, CostRange

logger = logging.getLogger(__name__)
settings = get_settings()

# ── System Prompts ─────────────────────────────────────────────────────────────

DIAGNOSTIC_SYSTEM_PROMPT = """
You are DriveSense AI Mechanic, an expert automotive diagnostic assistant.
When given an OBD-II DTC code and vehicle info, respond ONLY with a JSON object.

Respond with this exact JSON schema (no extra keys, no markdown fencing):
{
  "dtc_code": "string",
  "translation": "string (plain English name of the fault, ≤12 words)",
  "root_causes": ["string", ...],  // 3-5 most likely causes, ordered by probability
  "repair_steps": ["string", ...], // numbered steps 1..N, actionable and clear
  "cost_estimate_parts": {"low": number, "high": number, "currency": "string"},
  "cost_estimate_labor": {"low": number, "high": number, "currency": "string"},
  "diy_difficulty": "Easy|Medium|Hard|Expert",
  "ai_confidence": number,          // 0.0-1.0
  "urgency": "monitor|soon|urgent|immediate"
}

Urgency levels:
- monitor: can wait for next scheduled service (>3000 mi)
- soon: fix within 1000 miles / 1 month
- urgent: fix within 200 miles / 1 week
- immediate: do not drive, risk of damage or safety hazard
"""

PREVENTION_SYSTEM_PROMPT = """
You are DriveSense AI Mechanic. Analyze the vehicle's past DTC history and provide proactive maintenance advice.
Respond ONLY with a JSON object matching this schema:
{
  "tips": ["string", ...],
  "next_service_items": ["string", ...],
  "estimated_next_service_date": "string or null"
}
"""


def _build_diagnostic_user_msg(dtc_code: str, make: str, model: str, year: int,
                                mileage_km: float | None, region: str, currency: str) -> str:
    mileage_str = f"{mileage_km:,.0f} km" if mileage_km else "unknown mileage"
    return (
        f"DTC Code: {dtc_code}\n"
        f"Vehicle: {year} {make} {model}\n"
        f"Odometer: {mileage_str}\n"
        f"Region: {region}\n"
        f"Currency: {currency}\n"
        f"Provide cost estimates in {currency} for the {region} market."
    )


async def analyze_dtc(
    dtc_code: str,
    make: str,
    model: str,
    year: int,
    mileage_km: float | None = None,
    region: str = "United States",
    currency: str = "USD",
) -> DiagnosticResult:
    """Call the configured LLM and return a structured DiagnosticResult."""
    user_msg = _build_diagnostic_user_msg(dtc_code, make, model, year, mileage_km, region, currency)
    raw = await _call_llm(DIAGNOSTIC_SYSTEM_PROMPT, user_msg)
    data = json.loads(raw)
    # Normalize nested cost objects
    data["cost_estimate_parts"] = CostRange(**data["cost_estimate_parts"])
    data["cost_estimate_labor"] = CostRange(**data["cost_estimate_labor"])
    return DiagnosticResult(**data)


async def get_prevention_tips(
    past_dtc_codes: list[str],
    make: str,
    model: str,
    year: int,
    mileage_km: float | None = None,
) -> PreventionTipsResult:
    user_msg = (
        f"Vehicle: {year} {make} {model}\n"
        f"Odometer: {f'{mileage_km:,.0f} km' if mileage_km else 'unknown'}\n"
        f"Past DTC history: {', '.join(past_dtc_codes) if past_dtc_codes else 'None'}"
    )
    raw = await _call_llm(PREVENTION_SYSTEM_PROMPT, user_msg)
    return PreventionTipsResult(**json.loads(raw))


async def _call_llm(system_prompt: str, user_message: str) -> str:
    """Route to the configured LLM provider and return raw JSON string."""
    if settings.llm_provider == "openai":
        return await _call_openai(system_prompt, user_message)
    elif settings.llm_provider == "gemini":
        return await _call_gemini(system_prompt, user_message)
    else:
        raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")


async def _call_openai(system_prompt: str, user_message: str) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.2,
        max_tokens=1024,
    )
    return response.choices[0].message.content


async def _call_gemini(system_prompt: str, user_message: str) -> str:
    import re
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.google_gemini_api_key)

    full_prompt = f"{system_prompt}\n\n{user_message}"

    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents=full_prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
            max_output_tokens=2048,
        ),
    )

    raw = response.text or ""

    # Strip markdown fences if the model wrapped the JSON anyway
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    raw = re.sub(r"\s*```$", "", raw.strip())

    return raw
