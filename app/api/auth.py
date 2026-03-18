import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import TeamMember, Business
from ..utils.auth import hash_password, verify_password, create_access_token, decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Limiter instance — overwritten by main.py after app init
limiter = Limiter(key_func=get_remote_address)


# --- Request / Response schemas ---

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    business_name: str


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
@limiter.limit("10/hour")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(TeamMember).filter(TeamMember.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    business = Business(name=req.business_name)
    db.add(business)
    db.flush()

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
    logger.info(f"New business registered: {req.business_name} ({req.email})")

    token = create_access_token(team_member_id=member.id, business_id=business.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    member = db.query(TeamMember).filter(TeamMember.email == form.username).first()
    if not member or not verify_password(form.password, member.hashed_password):
        logger.warning(f"Failed login attempt for {form.username}")
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
