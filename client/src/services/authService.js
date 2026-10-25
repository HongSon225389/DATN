const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const readResponse = async (response) => {
  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không thể thực hiện yêu cầu");

    error.status = response.status;
    throw error;
  }

  return result;
};

const getCurrentUser = async ({ token, signal } = {}) => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal,
  });

  const result = await readResponse(response);

  if (!result.user || !["user", "admin"].includes(result.user.role)) {
    throw new Error("Thông tin tài khoản không hợp lệ");
  }

  return result.user;
};

const login = async ({ email, password }) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const result = await readResponse(response);

  if (typeof result.token !== "string" || !result.token) {
    throw new Error("API không trả về token hợp lệ");
  }

  const user = await getCurrentUser({
    token: result.token,
  });

  return {
    token: result.token,
    user,
  };
};

const register = async ({ name, email, password }) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });

  return readResponse(response);
};

const forgotPassword = async (email) => {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  return readResponse(response);
};

const resetPassword = async ({ token, password }) => {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, password }),
  });

  return readResponse(response);
};

export default {
  login,
  register,
  forgotPassword,
  resetPassword,
  getCurrentUser,
};
