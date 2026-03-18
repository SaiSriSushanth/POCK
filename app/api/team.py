from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from ..database import get_db
from ..models import TeamMember, CustomRole
from ..api.auth import get_current_member
from ..utils.auth import hash_password

router = APIRouter(prefix="/team", tags=["Team"])


class InviteRequest(BaseModel):
    email: str
    name: str
    password: str
    custom_role_id: Optional[str] = None


@router.get("")
def list_team(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    members = db.query(TeamMember).filter(TeamMember.business_id == current_member.business_id).all()
    result = []
    for m in members:
        custom_role = db.query(CustomRole).filter(CustomRole.id == m.custom_role_id).first() if m.custom_role_id else None
        result.append({
            "id": str(m.id),
            "email": m.email,
            "name": m.name,
            "role": m.role,
            "custom_role_id": str(m.custom_role_id) if m.custom_role_id else None,
            "custom_role_name": custom_role.name if custom_role else None,
        })
    return result


@router.post("/invite", status_code=201)
def invite_member(
    req: InviteRequest,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    if current_member.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite team members")

    existing = db.query(TeamMember).filter(TeamMember.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    custom_role_id = UUID(req.custom_role_id) if req.custom_role_id else None
    if custom_role_id:
        role_obj = db.query(CustomRole).filter(
            CustomRole.id == custom_role_id,
            CustomRole.business_id == current_member.business_id,
        ).first()
        if not role_obj:
            raise HTTPException(status_code=404, detail="Custom role not found")

    member = TeamMember(
        business_id=current_member.business_id,
        email=req.email,
        name=req.name,
        hashed_password=hash_password(req.password),
        role="agent",
        custom_role_id=custom_role_id,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return {"id": str(member.id), "email": member.email, "name": member.name, "role": member.role, "custom_role_id": str(member.custom_role_id) if member.custom_role_id else None}


@router.delete("/{member_id}", status_code=204)
def remove_member(
    member_id: str,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    if current_member.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can remove team members")

    if str(current_member.id) == member_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    member = db.query(TeamMember).filter(
        TeamMember.id == member_id,
        TeamMember.business_id == current_member.business_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()
