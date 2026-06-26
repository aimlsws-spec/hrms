from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="HRMS Auth Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

class OTPRequest(BaseModel):
    username: str
    otp: str

@app.post("/auth/login")
def login(request: LoginRequest):
    """Handle login and send OTP"""
    try:
        from hrms_agent.auth import UserManager
        user_manager = UserManager()
        
        result = user_manager.login(request.username, request.password)
        return result
    except Exception as e:
        return {"success": False, "message": f"Login error: {str(e)}"}

@app.post("/auth/verify-otp")
def verify_otp(request: OTPRequest):
    """Verify OTP and complete login"""
    try:
        from hrms_agent.auth import UserManager
        user_manager = UserManager()
        
        result = user_manager.verify_otp(request.username, request.otp)
        
        # Add redirect logic based on profile completion
        if result.get("success") and result.get("user"):
            user = result["user"]
            if not user.get("profile_completed", True):
                user["redirect_to"] = "profile"
            else:
                user["redirect_to"] = "portal"
        
        return result
    except Exception as e:
        return {"success": False, "message": f"OTP verification error: {str(e)}"}

@app.post("/auth/reset-password")
def reset_password(request: dict):
    """Reset user password"""
    try:
        from hrms_agent.auth import UserManager
        user_manager = UserManager()
        
        result = user_manager.reset_user_password(
            user_id=request.get("user_id"),
            new_password=request.get("new_password"),
            reset_by=request.get("reset_by"),
            reset_by_role=request.get("reset_by_role")
        )
        return result
    except Exception as e:
        return {"success": False, "message": f"Password reset error: {str(e)}"}

@app.post("/auth/update-role")
def update_role(request: dict):
    """Update user role"""
    try:
        from hrms_agent.auth import UserManager
        user_manager = UserManager()
        
        result = user_manager.update_user_role(
            user_id=request.get("user_id"),
            new_role=request.get("new_role"),
            updated_by=request.get("updated_by")
        )
        return result
    except Exception as e:
        return {"success": False, "message": f"Role update error: {str(e)}"}

@app.get("/auth/profile")
def get_profile(token: str = ""):
    """Get user profile from token"""
    try:
        from hrms_agent.auth import UserManager
        user_manager = UserManager()
        
        session = user_manager.verify_token(token)
        if session:
            return {"success": True, "session": session}
        else:
            return {"success": False, "message": "Invalid or expired token"}
    except Exception as e:
        return {"success": False, "message": f"Profile error: {str(e)}"}

@app.post("/auth/logout")
def logout(token: str = ""):
    """Logout user"""
    try:
        from hrms_agent.auth import UserManager
        user_manager = UserManager()
        
        result = user_manager.logout(token)
        return result
    except Exception as e:
        return {"success": False, "message": f"Logout error: {str(e)}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)