from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..models import TeamMember, CustomRole
from ..api.auth import get_current_member

router = APIRouter(prefix="/roles", tags=["Roles"])


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = ""


@router.get("")
def list_roles(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    roles = db.query(CustomRole).filter(CustomRole.business_id == current_member.business_id).all()
    return [{"id": str(r.id), "name": r.name, "description": r.description} for r in roles]


@router.post("", status_code=201)
def create_role(
    body: RoleCreate,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    if current_member.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create roles")

    role = CustomRole(
        business_id=current_member.business_id,
        name=body.name,
        description=body.description,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return {"id": str(role.id), "name": role.name, "description": role.description}


@router.delete("/{role_id}", status_code=204)
def delete_role(
    role_id: str,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    if current_member.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete roles")

    role = db.query(CustomRole).filter(
        CustomRole.id == role_id,
        CustomRole.business_id == current_member.business_id,
    ).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    db.delete(role)
    db.commit()
