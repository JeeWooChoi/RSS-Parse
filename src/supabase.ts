import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// .env 파일 로드
dotenv.config();
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
