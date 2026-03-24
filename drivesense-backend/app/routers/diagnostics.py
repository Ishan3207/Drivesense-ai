"""
Diagnostics Router – AI Mechanic Endpoints
-------------------------------------------
POST /api/v1/diagnostics/analyze         → Full DTC analysis
POST /api/v1/diagnostics/prevention-tips → Proactive maintenance
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.diagnostics import (
    DiagnosticRequest,
    DiagnosticResult,
    PreventionTipsRequest,
    PreventionTipsResult,
)
from app.services.llm_service import analyze_dtc, get_prevention_tips
from app.config import get_settings

settings = get_settings()
router = APIRouter()


@router.post(
    "/analyze",
    response_model=DiagnosticResult,
    tags=["AI Mechanic"],
    summary="Analyze a DTC code with the AI Mechanic",
)
async def analyze_diagnostic(req: DiagnosticRequest) -> DiagnosticResult:
    """
    Send a DTC code (e.g. P0420) + vehicle context to the LLM agent.
    Returns a structured JSON payload with root causes, repair steps,
    cost estimates, DIY difficulty, and urgency level.
    """
    if not settings.openai_api_key and not settings.google_gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="No LLM API key configured. Set OPENAI_API_KEY or GOOGLE_GEMINI_API_KEY in .env",
        )
    try:
        result = await analyze_dtc(
            dtc_code=req.dtc_code.upper().strip(),
            make=req.vehicle.make,
            model=req.vehicle.model,
            year=req.vehicle.year,
            mileage_km=req.vehicle.mileage_km,
            region=req.region or settings.default_region,
            currency=req.currency or settings.default_currency,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post(
    "/prevention-tips",
    response_model=PreventionTipsResult,
    tags=["AI Mechanic"],
    summary="Get proactive maintenance tips from DTC history",
)
async def prevention_tips(req: PreventionTipsRequest) -> PreventionTipsResult:
    """Analyze past DTC history and return proactive maintenance recommendations."""
    try:
        return await get_prevention_tips(
            past_dtc_codes=req.past_dtc_codes,
            make=req.vehicle.make,
            model=req.vehicle.model,
            year=req.vehicle.year,
            mileage_km=req.mileage_km,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
