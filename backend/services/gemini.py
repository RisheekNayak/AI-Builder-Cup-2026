import json
import logging
from typing import List
from backend.models.shipment import ExtractedData
from backend.models.risk_report import RiskReport, RiskFlag
from backend.services import llm
from backend.services.deterministic import lookup_hs_code, lookup_port

logger = logging.getLogger(__name__)
SEVERITY_ORDER = ["low", "medium", "high", "critical"]


def rules_report(extracted_data: ExtractedData, deterministic_flags: List[dict], fta_matches: List[dict], reason: str) -> RiskReport:
    """A report built only from deterministic checks, used when the AI review is unavailable."""
    flags: list[RiskFlag] = []
    for f in deterministic_flags:
        cat = f.get("data", {})
        flags.append(RiskFlag(severity="critical", title=f"Possible SCOMET item: {cat.get('name', f.get('category'))}",
                              description="An HS code or description matches the SCOMET list. Export needs a DGFT licence if confirmed.",
                              policy_citation="DGFT ITC(HS) Appendix 3 (SCOMET)", recommendation="Confirm classification before shipping; apply for a SCOMET licence if it applies."))
    for item in extracted_data.line_items:
        if not item.hs_code:
            flags.append(RiskFlag(severity="medium", title=f"HS code missing: {item.description[:60]}",
                                  description="The shipping bill and incentives (RoDTEP/drawback) need an 8-digit ITC-HS code.",
                                  policy_citation="CBIC Customs Tariff / ITC(HS)", recommendation="Add the 8-digit HS code before filing."))
        elif not lookup_hs_code(item.hs_code):
            flags.append(RiskFlag(severity="low", title=f"HS {item.hs_code} not in the local reference list",
                                  description="The code could not be checked against the local list of common codes.",
                                  policy_citation="ITC(HS) Schedule 2", recommendation="Verify the code against the ITC(HS) schedule."))
    if extracted_data.port_of_loading and not lookup_port(extracted_data.port_of_loading):
        flags.append(RiskFlag(severity="low", title=f"Port code {extracted_data.port_of_loading} not recognised",
                              description="The port of loading is not in the local list of Indian port codes.",
                              policy_citation="ICEGATE port codes", recommendation="Use the 6-character port code, e.g. INNSA1."))
    forms = ["Shipping Bill", "Certificate of Origin"]
    savings = None
    if fta_matches:
        savings = f"Possible preferential duty under {fta_matches[0].get('name')}, subject to its origin rule: {fta_matches[0].get('origin_criteria')}"
    if deterministic_flags:
        forms.append("End User Undertaking")
    score = max((f.severity for f in flags), key=SEVERITY_ORDER.index, default="low")
    return RiskReport(overall_score=score, flags=flags, required_forms=forms, duty_savings=savings, mode="rules",
                      analysis_summary=f"Rules-only check (AI review unavailable: {reason}). SCOMET, HS code, port and FTA checks ran; "
                                       "policy interpretation was not done.")


async def analyze_compliance(extracted_data: ExtractedData, search_results: List[dict], deterministic_flags: List[dict],
                             fta_matches: List[dict] | None = None) -> RiskReport:
    fta_matches = fta_matches or []
    if not llm.enabled():
        return rules_report(extracted_data, deterministic_flags, fta_matches, "AI is offline")
    prompt = f"""You are an Indian export compliance reviewer. Assess this shipment using ONLY the data and context below.
Shipment: {extracted_data.model_dump_json()}
SCOMET checks (deterministic): {json.dumps(deterministic_flags)}
FTA matches for the destination (deterministic): {json.dumps([{k: a.get(k) for k in ('name', 'origin_criteria', 'certificate_form_name', 'key_benefits')} for a in fta_matches])}
Policy context: {json.dumps(search_results)[:6000]}
Return JSON: {{"overall_score": "low|medium|high|critical", "flags": [{{"severity": "low|medium|high|critical", "title": "", "description": "",
"policy_citation": "name the document or rule from the context, or 'General practice'", "recommendation": ""}}],
"required_forms": ["Shipping Bill", "Certificate of Origin", "End User Undertaking" (only if SCOMET applies)], "duty_savings": "string or null",
"analysis_summary": "2 sentences"}}"""
    try:
        data = await llm.generate_json(prompt)
        report = RiskReport(**{**data, "mode": "ai"})
        return report
    except (llm.LLMUnavailable, ValueError, TypeError) as error:
        logger.warning("AI compliance review failed, using rules-only report: %s", error)
        return rules_report(extracted_data, deterministic_flags, fta_matches, str(error)[:120])


async def advisor_chat(message: str, search_results: List[dict]) -> dict:
    sources = [s.get("source") for s in search_results if s.get("source")]
    if llm.enabled():
        try:
            reply = await llm.generate_text(
                f"You are a trade advisor for Indian exporters. Answer using the context; say when the context does not cover it.\n"
                f"Context: {json.dumps(search_results)[:6000]}\nQuestion: {message}")
            return {"reply": reply, "sources": sources, "mode": "ai"}
        except llm.LLMUnavailable:
            pass
    lines = [f"- {r.get('title') or r.get('source')}: {r.get('content', '')[:240]}" for r in search_results[:3]]
    reply = ("AI answers are unavailable right now. Closest matches in the knowledge base:\n" + "\n".join(lines)) if lines \
        else "AI answers are unavailable right now, and nothing in the knowledge base matched your question."
    return {"reply": reply, "sources": sources, "mode": "offline"}
