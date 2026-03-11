from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from uuid import UUID

from ..database import get_db
from ..models import TeamMember, Business
from ..utils.auth import hash_password, verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# --- Request / Response schemas ---

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    business_name: str  # creates a new Business on first register


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Dependency: get current team member from JWT ---

def get_current_member(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> TeamMember:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    member = db.query(TeamMember).filter(TeamMember.id == payload["sub"]).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return member


# --- Endpoints ---

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(TeamMember).filter(TeamMember.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create a new Business for this registration
    business = Business(name=req.business_name)
    db.add(business)
    db.flush()  # get business.id before committing

    member = TeamMember(
        business_id=business.id,
        email=req.email,
        name=req.name,
        hashed_password=hash_password(req.password),
        role="admin",
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    token = create_access_token(team_member_id=member.id, business_id=business.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    member = db.query(TeamMember).filter(TeamMember.email == form.username).first()
    if not member or not verify_password(form.password, member.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    token = create_access_token(team_member_id=member.id, business_id=member.business_id)
    return TokenResponse(access_token=token)


@router.get("/me")
def get_me(current_member: TeamMember = Depends(get_current_member)):
    return {
        "id": current_member.id,
        "email": current_member.email,
        "name": current_member.name,
        "role": current_member.role,
        "business_id": current_member.business_id,
    }
