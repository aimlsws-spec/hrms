"""
Enhanced Sentiment Analysis for HRMS Remarks System
Human-thinking centric AI model with only Positive/Negative classification
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
import mysql.connector
from datetime import datetime

router = APIRouter()

# Enhanced sentiment analysis with human-thinking approach
class SentimentAnalyzer:
    def __init__(self):
        # Positive indicators - what humans perceive as positive
        self.positive_keywords = {
            # Excellence & Quality
            'excellent', 'outstanding', 'exceptional', 'superb', 'brilliant', 'perfect',
            'amazing', 'fantastic', 'wonderful', 'great', 'good', 'impressive',
            
            # Performance & Achievement
            'achieved', 'accomplished', 'succeeded', 'exceeded', 'improved', 'progress',
            'growth', 'development', 'advancement', 'success', 'milestone',
            
            # Work Ethic & Attitude
            'dedicated', 'committed', 'hardworking', 'diligent', 'motivated', 'proactive',
            'enthusiastic', 'passionate', 'reliable', 'dependable', 'consistent',
            
            # Skills & Competence
            'skilled', 'talented', 'capable', 'competent', 'proficient', 'expert',
            'efficient', 'effective', 'productive', 'innovative', 'creative',
            
            # Team & Collaboration
            'helpful', 'supportive', 'collaborative', 'cooperative', 'team player',
            
            # Recognition & Praise
            'appreciate', 'commend', 'congratulations', 'well done', 'keep it up',
            'proud', 'impressed', 'satisfied', 'pleased', 'happy',
            
            # Improvement (when positive context)
            'better', 'stronger', 'faster', 'smarter', 'enhanced'
        }
        
        # Negative indicators - what humans perceive as negative
        self.negative_keywords = {
            # Poor Performance
            'poor', 'bad', 'terrible', 'awful', 'horrible', 'disappointing',
            'unsatisfactory', 'inadequate', 'insufficient', 'substandard', 'below',
            
            # Failures & Problems
            'failed', 'failure', 'mistake', 'error', 'problem', 'issue', 'concern',
            'trouble', 'difficulty', 'struggle', 'unable', 'cannot', 'didn\'t',
            
            # Negative Behaviors
            'careless', 'negligent', 'irresponsible', 'unprofessional', 'lazy',
            'sloppy', 'messy', 'disorganized', 'chaotic', 'rude', 'arrogant',
            
            # Time & Deadlines
            'late', 'delayed', 'missed', 'overdue', 'behind', 'slow',
            
            # Quality Issues
            'incomplete', 'unfinished', 'lacking', 'deficient', 'weak', 'flawed',
            
            # Warnings & Criticism
            'warning', 'unacceptable', 'must improve', 'need to', 'should have',
            'disappointed', 'concerned', 'worried', 'frustrated'
        }
        
        # Constructive phrases - context matters
        self.constructive_positive = {
            'nice performance', 'good work', 'well done', 'keep going',
            'on track', 'making progress', 'getting better', 'showing improvement'
        }
        
        self.constructive_negative = {
            'needs improvement', 'room for improvement', 'could be better',
            'not meeting expectations', 'falling short', 'requires attention'
        }
    
    def analyze(self, text: str) -> str:
        """
        Analyze sentiment with human-thinking approach
        Returns: 'Positive' or 'Negative'
        """
        text_lower = text.lower().strip()
        
        # Check for constructive phrases first (they provide clear context)
        for phrase in self.constructive_positive:
            if phrase in text_lower:
                # Even if followed by "but improve", the overall tone is encouraging
                return 'Positive'
        
        for phrase in self.constructive_negative:
            if phrase in text_lower:
                return 'Negative'
        
        # Count positive and negative indicators
        positive_score = 0
        negative_score = 0
        
        # Check positive keywords
        for keyword in self.positive_keywords:
            if keyword in text_lower:
                positive_score += 1
        
        # Check negative keywords
        for keyword in self.negative_keywords:
            if keyword in text_lower:
                negative_score += 1
        
        # Human thinking: Look for improvement context
        # "improve" can be positive or negative depending on context
        if 'improve' in text_lower or 'improvement' in text_lower:
            # Check if it's encouraging improvement (positive) or demanding it (negative)
            if any(word in text_lower for word in ['nice', 'good', 'great', 'but', 'keep', 'continue']):
                positive_score += 1  # Encouraging improvement
            elif any(word in text_lower for word in ['must', 'need', 'should', 'require']):
                negative_score += 1  # Demanding improvement
            else:
                positive_score += 0.5  # Neutral improvement mention, lean positive
        
        # Decision logic - human thinking approach
        if positive_score > negative_score:
            return 'Positive'
        elif negative_score > positive_score:
            return 'Negative'
        else:
            # Tie or no clear indicators
            # Check overall tone - length and structure
            if len(text_lower) < 20:
                # Short remarks are usually direct
                return 'Positive' if positive_score > 0 else 'Negative'
            else:
                # Longer remarks with balanced keywords - look at structure
                # If starts positive, it's likely positive overall
                first_half = text_lower[:len(text_lower)//2]
                first_half_positive = sum(1 for kw in self.positive_keywords if kw in first_half)
                return 'Positive' if first_half_positive > 0 else 'Negative'

# Initialize analyzer
analyzer = SentimentAnalyzer()

# Pydantic models
class RemarkCreate(BaseModel):
    model_config = ConfigDict(extra='ignore')
    
    employee_id: str
    remark: str
    created_by: str
    created_by_name: str

class RemarkResponse(BaseModel):
    id: int
    employee_id: str
    employee_name: Optional[str]
    remark: str
    sentiment: str
    created_by: str
    created_by_name: str
    created_at: str

# Database connection
def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="Root@123",
        database="hrms"
    )

@router.post("/api/remarks/add")
async def add_remark(remark_data: dict):
    """Add a new remark with AI sentiment analysis"""
    print(f"Received remark data: {remark_data}")
    db = get_db()
    cursor = db.cursor()
    try:
        # Extract required fields
        employee_id = remark_data.get('employee_id')
        remark = remark_data.get('remark')
        created_by = remark_data.get('created_by')
        created_by_name = remark_data.get('created_by_name')
        
        print(f"Extracted - employee_id: {employee_id}, remark: {remark}, created_by: {created_by}, created_by_name: {created_by_name}")
        
        if not all([employee_id, remark, created_by, created_by_name]):
            missing = []
            if not employee_id: missing.append('employee_id')
            if not remark: missing.append('remark')
            if not created_by: missing.append('created_by')
            if not created_by_name: missing.append('created_by_name')
            print(f"Missing fields: {missing}")
            raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing)}")
        
        sentiment = analyzer.analyze(remark)
        
        query = """INSERT INTO remarks (employee_id, remark, sentiment, created_by, created_by_name) 
                   VALUES (%s, %s, %s, %s, %s)"""
        cursor.execute(query, (
            employee_id,
            remark,
            sentiment,
            created_by,
            created_by_name
        ))
        db.commit()
        
        return {
            "success": True,
            "message": "Remark added successfully",
            "sentiment": sentiment,
            "remark_id": cursor.lastrowid
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error adding remark: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.get("/api/remarks/all")
async def get_all_remarks():
    """Get all remarks"""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM remarks ORDER BY created_at DESC")
        remarks = cursor.fetchall()
        # Convert datetime to string
        for r in remarks:
            if r.get('created_at'):
                r['created_at'] = r['created_at'].isoformat()
        return {
            "success": True,
            "remarks": remarks,
            "count": len(remarks)
        }
    except Exception as e:
        return {"success": False, "remarks": [], "count": 0, "message": str(e)}
    finally:
        cursor.close()
        db.close()

@router.get("/api/remarks/employee/{employee_id}")
async def get_employee_remarks(employee_id: str):
    """Get remarks for a specific employee"""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM remarks WHERE employee_id = %s ORDER BY created_at DESC", (employee_id,))
        remarks = cursor.fetchall()
        for r in remarks:
            if r.get('created_at'):
                r['created_at'] = r['created_at'].isoformat()
        return {
            "success": True,
            "remarks": remarks,
            "count": len(remarks)
        }
    except Exception as e:
        return {"success": False, "remarks": [], "count": 0, "message": str(e)}
    finally:
        cursor.close()
        db.close()
