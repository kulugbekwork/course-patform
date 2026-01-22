import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { studentId, teacherId } = await req.json();

    if (!studentId || !teacherId) {
      throw new Error("Missing required fields: studentId, teacherId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify that the student belongs to the teacher
    const { data: studentProfile, error: profileCheckError } = await supabase
      .from("profiles")
      .select("id, created_by, role")
      .eq("id", studentId)
      .eq("role", "student")
      .eq("created_by", teacherId)
      .single();

    if (profileCheckError || !studentProfile) {
      throw new Error("Student not found or you do not have permission to delete this student");
    }

    // Delete the profile first (this will cascade to related tables if foreign keys are set up)
    const { error: profileDeleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", studentId)
      .eq("created_by", teacherId);

    if (profileDeleteError) {
      throw new Error(`Failed to delete student profile: ${profileDeleteError.message}`);
    }

    // Delete the auth user
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(studentId);

    if (authDeleteError) {
      // Log the error but don't fail - profile is already deleted
      console.error("Failed to delete auth user (profile already deleted):", authDeleteError);
      // Still return success since profile deletion succeeded
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Student deleted successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
