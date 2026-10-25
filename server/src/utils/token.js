import jwt from "jsonwebtoken";

const getSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length < 64) {
    throw new Error("JWT_SECRET chưa được cấu hình đủ dài");
  }

  return secret;
};

const generateToken = (userId, tokenVersion = 0) => {
  return jwt.sign({ tokenVersion }, getSecret(), {
    subject: userId.toString(),
    algorithm: "HS256",
    expiresIn: "1h",
    issuer: "hanoi-flood-api",
    audience: "hanoi-flood-web",
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, getSecret(), {
    algorithms: ["HS256"],
    issuer: "hanoi-flood-api",
    audience: "hanoi-flood-web",
  });
};

export default {
  generateToken,
  verifyToken,
};
