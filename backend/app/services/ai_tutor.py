import httpx
import logging
import re
from app.config import settings

logger = logging.getLogger(__name__)

def generate_heuristic_hint(code: str, problem_title: str, tags: list, compile_error: str = None) -> str:
    """
    Local heuristic-based fallback hints generator.
    Parses code structure, tags, and compiler output to produce helpful tutor messages.
    """
    # 1. Compilation Error Heuristics
    if compile_error:
        ce_lower = compile_error.lower()
        if "was not declared in this scope" in ce_lower:
            match = re.search(r"'(\w+)' was not declared in this scope", compile_error)
            var_name = match.group(1) if match else "variable"
            return f"💡 **Tutor Hint**: The variable or function `{var_name}` is used but not declared. Check for spelling errors, verify that it is declared in the correct scope, or check if you missed a library header include."
        if "no matching function for call to" in ce_lower or "candidate template ignored" in ce_lower:
            return "💡 **Tutor Hint**: Function parameter mismatch. Check the count, type, and order of arguments passed to your function or standard libraries (e.g. `std::sort` or `std::max`)."
        if "cannot convert" in ce_lower:
            return "💡 **Tutor Hint**: Data type mismatch. You are trying to assign or convert incompatible types (e.g. converting a pointer to an integer or assigning `std::string` directly to a `char`)."
        if "expected ';'" in ce_lower or "expected ':'" in ce_lower:
            return "💡 **Tutor Hint**: Syntax error. Check if you missed a semicolon (`;`) or bracket at the end of a line, or a colon inside a switch block or initializer list."
        return "💡 **Tutor Hint**: Compilation failed. Read the compiler error trace; check the line numbers indicated in the first few lines of the error to locate the syntax problem."

    # 2. Code Quality Heuristics (e.g., Integer Overflow)
    code_lower = code.lower()
    if "int" in code_lower and "long long" not in code_lower:
        # Check if modulo arithmetic or large bounds are in tags
        if any(t in tags for t in ["Math", "Dynamic Programming", "Combinatorics", "Number Theory"]):
            return "💡 **Tutor Hint**: Potential Integer Overflow! You are using standard `int` variables. For inputs up to 10^9 or when adding/multiplying large numbers, values will overflow the C++ signed 32-bit limit. Try changing accumulators and variables to `long long`."

    # 3. Tag-specific heuristics
    for t in tags:
        t_lower = t.lower()
        if "dynamic programming" in t_lower or "dp" in t_lower:
            return "💡 **Tutor Hint (DP)**: Check your state transition. Are the base cases (e.g. DP[0], DP[1]) initialized correctly? Ensure you handle boundary constraints and edge cases (like empty/zero inputs)."
        if "graphs" in t_lower or "dfs" in t_lower or "bfs" in t_lower:
            return "💡 **Tutor Hint (Graphs)**: Check your node traversal logic. Make sure you are marking nodes as visited properly to prevent infinite loops, recursion depth crashes (segmentation faults), or Memory Limit Exceeded (MLE) failures."
        if "binary search" in t_lower:
            return "💡 **Tutor Hint (Binary Search)**: Verify search space bounds. Ensure you compute the mid-point safely: `mid = low + (high - low) / 2` to avoid integer overflow, and check that the boundaries shrink on every iteration to prevent infinite loops."

    return "💡 **Tutor Hint**: Check if your logic handles corner cases correctly, such as empty collections, single elements, or variables initialized to zero. Verify that fast I/O is enabled: `ios_base::sync_with_stdio(false); cin.tie(NULL);`."

async def get_tutor_hint(code: str, problem_title: str, description_html: str, tags: list, compile_error: str = None) -> str:
    """
    Asks Claude (via Anthropic API) for a hints explanation.
    Falls back to local heuristics if Anthropic API fails.
    """
    key = settings.ANTHROPIC_API_KEY
    if not key or "aero_live_" in key or "your_api_key" in key.lower():
        logger.info("Using local heuristic hint generator due to proxy or key constraints.")
        return generate_heuristic_hint(code, problem_title, tags, compile_error)

    base_url = "https://api.anthropic.com"
    if hasattr(settings, "ANTHROPIC_BASE_URL") and settings.ANTHROPIC_BASE_URL:
        base_url = settings.ANTHROPIC_BASE_URL.rstrip("/")

    url = f"{base_url}/v1/messages"
    
    headers = {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    # Clean description tags to keep prompt length small
    clean_desc = re.sub('<[^<]+?>', '', description_html)[:1500] if description_html else ""

    prompt = f"""You are a helpful programming tutor for competitive coding.
A student is working on the problem: "{problem_title}".
Tags: {', '.join(tags)}
Problem Description:
{clean_desc}

Here is the student's C++ code:
```cpp
{code}
```
"""

    if compile_error:
        prompt += f"\nThe compilation failed with this error:\n{compile_error}\n"
    else:
        prompt += "\nThe code compiled but failed test cases (either wrong answer or runtime exception).\n"

    prompt += "\nPlease give a short hint (max 3 sentences) to help the student debug. DO NOT write code or provide the full C++ solution. Focus on logic flaws, corner cases, or standard C++ traps."

    payload = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 300,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(url, json=payload, headers=headers, timeout=12.0)
            if r.status_code == 200:
                res = r.json()
                return res["content"][0]["text"]
            else:
                logger.warning(f"Anthropic API returned status {r.status_code}. Falling back to heuristics.")
    except Exception as e:
        logger.error(f"Failed to query Anthropic API: {e}. Falling back to heuristics.")

    return generate_heuristic_hint(code, problem_title, tags, compile_error)
