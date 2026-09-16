import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your name.").max(100, "Name must be 100 characters or fewer."),
    email: z.string().trim().email("Enter a valid email address.").max(255, "Email must be 255 characters or fewer."),
    password: z.string().min(8, "Use a password with at least 8 characters.").max(72, "Password must be 72 characters or fewer."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "The passwords do not match.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
