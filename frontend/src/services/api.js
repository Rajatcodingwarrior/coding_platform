const API_BASE_URL = "http://localhost:8000/api";

const getHeaders = () => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Authentication
  auth: {
    signup: async (username, email, password) => {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Signup failed");
      }
      return res.json();
    },
    login: async (username, password) => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Login failed");
      }
      return res.json();
    },
    logout: async () => {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: getHeaders(),
        });
      } catch (e) {
        console.error("Logout request failed:", e);
      }
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    },
    me: async () => {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) {
        throw new Error("Failed to fetch user profile");
      }
      return res.json();
    },
  },

  // Contests & Questions
  contests: {
    list: async () => {
      const res = await fetch(`${API_BASE_URL}/contests`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch contests");
      return res.json();
    },
    getQuestions: async (contestId) => {
      const res = await fetch(`${API_BASE_URL}/contests/${contestId}/questions`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
    sync: async () => {
      const res = await fetch(`${API_BASE_URL}/contests/sync`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to trigger sync");
      return res.json();
    },
  },

  questions: {
    get: async (questionId) => {
      const res = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch question details");
      return res.json();
    },
  },

  // Compiler / Run code
  compiler: {
    run: async (code, stdin) => {
      const res = await fetch(`${API_BASE_URL}/compiler/run`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ code, stdin }),
      });
      if (!res.ok) throw new Error("Compiler run failed");
      return res.json();
    },
    submit: async (questionId, code) => {
      const res = await fetch(`${API_BASE_URL}/compiler/submit`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ question_id: questionId, code }),
      });
      if (!res.ok) throw new Error("Submission failed");
      return res.json();
    },
  },

  // Dashboard / Progress
  dashboard: {
    stats: async () => {
      const res = await fetch(`${API_BASE_URL}/dashboard/stats`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    chooseForMe: async () => {
      const res = await fetch(`${API_BASE_URL}/dashboard/choose-for-me`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch random unsolved question");
      return res.json();
    },
    toggleFavorite: async (questionId, isFavorite) => {
      const res = await fetch(`${API_BASE_URL}/dashboard/questions/${questionId}/favorite`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ is_favorite: isFavorite }),
      });
      if (!res.ok) throw new Error("Failed to update favorite status");
      return res.json();
    },
    toggleComplete: async (questionId, isSolved) => {
      const res = await fetch(`${API_BASE_URL}/dashboard/questions/${questionId}/complete`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ is_solved: isSolved }),
      });
      if (!res.ok) throw new Error("Failed to update complete status");
      return res.json();
    },
  },
};
