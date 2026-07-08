import httpx
import logging

logger = logging.getLogger(__name__)

async def run_code(code: str, stdin: str) -> dict:
    """
    Compiles and executes C++ code with standard input using the Compiler Explorer API.
    Returns:
        dict: {
            "success": bool,
            "error": str,
            "compile_error": str,
            "stdout": str,
            "stderr": str,
            "exec_time": int (ms)
        }
    """
    url = "https://godbolt.org/api/compiler/g131/compile"
    payload = {
        "source": code,
        "options": {
            "userArguments": "-O3",
            "compilerOptions": {
                "executorRequest": True
            },
            "filters": {
                "execute": True
            },
            "executeParameters": {
                "args": [],
                "stdin": stdin
            },
            "tools": []
        },
        "lang": "c++"
    }
    
    headers = {"Accept": "application/json"}
    
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(url, json=payload, headers=headers, timeout=20.0)
            
            if r.status_code != 200:
                logger.error(f"Compiler Explorer returned status {r.status_code}: {r.text}")
                return {
                    "success": False,
                    "error": f"Compiler API error (HTTP {r.status_code})",
                    "compile_error": "",
                    "stdout": "",
                    "stderr": "",
                    "exec_time": 0
                }
                
            res = r.json()
            
            # Check for compilation errors
            build_res = res.get("buildResult", {})
            build_code = build_res.get("code", 0)
            
            if build_code != 0:
                # Compilation failed, collect stderr lines
                err_lines = [item.get("text", "") for item in build_res.get("stderr", [])]
                compile_error = "\n".join(err_lines)
                
                # Check if there is also normal stderr (some compilers output errors there)
                if not compile_error:
                    normal_err_lines = [item.get("text", "") for item in res.get("stderr", [])]
                    compile_error = "\n".join(normal_err_lines)
                    
                return {
                    "success": False,
                    "error": "Compilation failed",
                    "compile_error": compile_error,
                    "stdout": "",
                    "stderr": "",
                    "exec_time": 0
                }
                
            # Program executed successfully
            stdout_lines = [item.get("text", "") for item in res.get("stdout", [])]
            stderr_lines = [item.get("text", "") for item in res.get("stderr", [])]
            
            return {
                "success": True,
                "error": "",
                "compile_error": "",
                "stdout": "\n".join(stdout_lines),
                "stderr": "\n".join(stderr_lines),
                "exec_time": res.get("execTime", 0)
            }
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": "Compilation and execution timed out (limit: 20 seconds)",
            "compile_error": "",
            "stdout": "",
            "stderr": "",
            "exec_time": 0
        }
    except Exception as e:
        logger.error(f"Failed to execute code: {e}")
        return {
            "success": False,
            "error": f"Internal execution system error: {str(e)}",
            "compile_error": "",
            "stdout": "",
            "stderr": "",
            "exec_time": 0
        }
