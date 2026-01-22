import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.VITE_SUPABASE_URL. Please check your .env file.');
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.VITE_SUPABASE_ANON_KEY. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  username: string;
  role: 'teacher' | 'student';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  full_name?: string | null;
  initial_password?: string | null;
  email?: string | null;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  video_url: string;
  teacher_id: string;
  created_at: string;
  updated_at: string;
}

export interface CourseAccess {
  id: string;
  course_id: string;
  student_id: string;
  granted_by: string;
  granted_at: string;
}

export interface StudentGroup {
  id: string;
  teacher_id: string;
  name: string;
  created_at: string;
}

export interface StudentGroupMember {
  id: string;
  group_id: string;
  student_id: string;
  created_at: string;
}
