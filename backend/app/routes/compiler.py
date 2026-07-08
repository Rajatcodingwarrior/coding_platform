from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.database import get_database
from app.auth import get_current_user
from app.services.compiler import run_code

router = APIRouter(prefix="/compiler", tags=["Code Compiler & Runner"])

class RunCodeRequest(BaseModel):
    code: str
    stdin: str

class SubmitCodeRequest(BaseModel):
    question_id: str
    code: str

class TestCaseResult(BaseModel):
    test_case_index: int
    input: str
    expected_output: str
    actual_output: str
    stderr: str
    compile_error: str
    passed: bool

class SubmitCodeResponse(BaseModel):
    success: bool
    message: str
    results: List[TestCaseResult]
    compile_error: Optional[str] = None

@router.post("/run")
async def run_custom_code(req: RunCodeRequest, current_user: dict = Depends(get_current_user)):
    """
    Compiles and runs C++ code with custom stdin.
    """
    res = await run_code(req.code, req.stdin)
    return res

@router.post("/submit", response_model=SubmitCodeResponse)
async def submit_question_code(req: SubmitCodeRequest, current_user: dict = Depends(get_current_user)):
    """
    Evaluates user C++ code against all stored test cases of a question.
    If all pass, marks the question as solved.
    """
    db = get_database()
    user_id = current_user["_id"]
    
    # 1. Fetch question
    q = await db.questions.find_one({"_id": req.question_id})
    if not q:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
        
    test_cases = q.get("test_cases", [])
    if not test_cases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No test cases found for this problem to evaluate."
        )
        
    # Save the submission code for the user
    await db.user_progress.update_one(
        {"user_id": user_id, "question_id": req.question_id},
        {"$set": {
            "last_submission_code": req.code,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    results = []
    all_passed = True
    compilation_error_str = None
    
    # 2. Run code on each test case
    for idx, tc in enumerate(test_cases):
        run_res = await run_code(req.code, tc["input"])
        
        # Check compile error
        if not run_res["success"] and run_res["error"] == "Compilation failed":
            compilation_error_str = run_res["compile_error"]
            all_passed = False
            results.append(TestCaseResult(
                test_case_index=idx + 1,
                input=tc["input"],
                expected_output=tc["output"],
                actual_output="",
                stderr="",
                compile_error=compilation_error_str,
                passed=False
            ))
            break # No need to run further if compilation fails
            
        if not run_res["success"]:
            # Timeout or API issues
            all_passed = False
            results.append(TestCaseResult(
                test_case_index=idx + 1,
                input=tc["input"],
                expected_output=tc["output"],
                actual_output="",
                stderr=run_res["error"],
                compile_error="",
                passed=False
            ))
            continue
            
        # Compare output (case-insensitive, whitespace-trimmed comparison)
        actual = run_res["stdout"].strip().replace("\r\n", "\n")
        expected = tc["output"].strip().replace("\r\n", "\n")
        
        # Strip trailing carriage returns/spaces line-by-line
        actual_lines = [line.rstrip() for line in actual.splitlines()]
        expected_lines = [line.rstrip() for line in expected.splitlines()]
        
        # Re-join
        actual_cleaned = "\n".join(actual_lines)
        expected_cleaned = "\n".join(expected_lines)
        
        passed = actual_cleaned == expected_cleaned
        if not passed:
            all_passed = False
            
        results.append(TestCaseResult(
            test_case_index=idx + 1,
            input=tc["input"],
            expected_output=tc["output"],
            actual_output=run_res["stdout"],
            stderr=run_res["stderr"],
            compile_error="",
            passed=passed
        ))
        
    # 3. If all passed, mark question as completed
    if all_passed and results:
        await db.user_progress.update_one(
            {"user_id": user_id, "question_id": req.question_id},
            {"$set": {
                "status": "solved",
                "solved_at": datetime.utcnow()
            }},
            upsert=True
        )
        message = "Success! All test cases passed."
    elif compilation_error_str:
        message = "Compilation failed."
    else:
        message = "Wrong Answer on some test cases."
        
    return SubmitCodeResponse(
        success=all_passed,
        message=message,
        results=results,
        compile_error=compilation_error_str
    )
