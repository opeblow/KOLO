import { z } from "zod";

export const memberInput = z.object({
  name: z.string().trim().min(1).max(80).describe("Member's name as the group knows them"),
  phone: z
    .string()
    .trim()
    .max(24)
    .optional()
    .describe("WhatsApp number in international format, e.g. +2348031234567"),
  aliases: z
    .array(z.string().trim().min(2).max(80))
    .max(10)
    .optional()
    .describe("Names their bank prints on transfers, e.g. 'ADEBAYO TUNDE O'"),
});

export const circleIdArg = z.string().min(1).describe("Circle id from list-circles");
