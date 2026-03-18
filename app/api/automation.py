from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..models import TeamMember, AutomationRule
from ..api.auth import get_current_member

router = APIRouter(prefix="/automation", tags=["Automation"])


class RuleCreate(BaseModel):
    name: str
    trigger_label: str
    action_type: str   # 'assign_to_role' | 'set_priority' | 'set_status' | 'auto_reply'
    action_value: str


class RuleUpdate(BaseModel):
    is_active: Optional[bool] = None
    name: Optional[str] = None
    trigger_label: Optional[str] = None
    action_type: Optional[str] = None
    action_value: Optional[str] = None


@router.get("")
def list_rules(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    rules = db.query(AutomationRule).filter(AutomationRule.business_id == current_member.business_id).all()
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "trigger_label": r.trigger_label,
            "action_type": r.action_type,
            "action_value": r.action_value,
            "is_active": r.is_active,
        }
        for r in rules
    ]


@router.post("", status_code=201)
def create_rule(
    body: RuleCreate,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    rule = AutomationRule(
        business_id=current_member.business_id,
        name=body.name,
        trigger_label=body.trigger_label,
        action_type=body.action_type,
        action_value=body.action_value,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": str(rule.id), "name": rule.name, "trigger_label": rule.trigger_label, "action_type": rule.action_type, "action_value": rule.action_value, "is_active": rule.is_active}


@router.patch("/{rule_id}")
def update_rule(
    rule_id: str,
    body: RuleUpdate,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.business_id == current_member.business_id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if body.is_active is not None:
        rule.is_active = body.is_active
    if body.name is not None:
        rule.name = body.name
    if body.trigger_label is not None:
        rule.trigger_label = body.trigger_label
    if body.action_type is not None:
        rule.action_type = body.action_type
    if body.action_value is not None:
        rule.action_value = body.action_value

    db.commit()
    return {"id": str(rule.id), "name": rule.name, "trigger_label": rule.trigger_label, "action_type": rule.action_type, "action_value": rule.action_value, "is_active": rule.is_active}


@router.delete("/{rule_id}", status_code=204)
def delete_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.business_id == current_member.business_id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(rule)
    db.commit()
