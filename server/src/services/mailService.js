import nodemailer from "nodemailer";

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const user = process.env.MAIL_USER?.trim();
  const password = process.env.MAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!user || !password) {
    throw new Error("Chưa cấu hình MAIL_USER hoặc MAIL_APP_PASSWORD");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass: password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return transporter;
};

const sendPasswordResetEmail = async ({ email, resetUrl }) => {
  await getTransporter().sendMail({
    from: {
      name: "Hanoi Flood",
      address: process.env.MAIL_USER.trim(),
    },
    to: email,
    subject: "Đặt lại mật khẩu Hanoi Flood",
    text: [
      "Bạn vừa yêu cầu đặt lại mật khẩu Hanoi Flood.",
      "",
      "Mở liên kết sau để đặt mật khẩu mới:",
      resetUrl,
      "",
      "Liên kết có hiệu lực trong 15 phút và chỉ dùng được một lần.",
      "Nếu không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.",
    ].join("\n"),
  });
};

export default {
  sendPasswordResetEmail,
};
