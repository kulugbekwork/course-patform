import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const firstNames = [
  "Alex", "Jordan", "Casey", "Morgan", "Taylor", "Riley", "Blake", "Avery",
  "Sam", "Quinn", "Dakota", "Phoenix", "Cameron", "River", "Skylar", "Reese"
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas"
];

function generateRandomUser() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomNum = Math.floor(Math.random() * 10000);
  const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${randomNum}`;
  const password = `Pass${Math.random().toString(36).substring(2, 10)}123`;
  
  return { firstName, lastName, username, password };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const students = [];
    const createdUsers = [];

    // Generate 3 random students
    for (let i = 0; i < 3; i++) {
      const user = generateRandomUser();
      
      // Create auth user
      const { data, error } = await supabase.auth.admin.createUser({
        email: `${user.username}@platform.local`,
        password: user.password,
        user_metadata: {
          full_name: `${user.firstName} ${user.lastName}`,
        },
      });

      if (error) {
        console.error(`Failed to create user ${user.username}:`, error);
        continue;
      }

      if (data?.user?.id) {
        // Add to profiles table
        await supabase.from("profiles").insert({
          id: data.user.id,
          username: user.username,
          role: "student",
          created_by: "70eb34f8-0380-4ed8-945e-475012105e37", // ulugbek_dev teacher ID
        });

        createdUsers.push({
          name: `${user.firstName} ${user.lastName}`,
          username: user.username,
          password: user.password,
          role: "student",
          userId: data.user.id,
        });
      }
    }

    // Generate 1 random teacher
    const teacherUser = generateRandomUser();
    const { data: teacherData, error: teacherError } = await supabase.auth.admin.createUser({
      email: `${teacherUser.username}@platform.local`,
      password: teacherUser.password,
      user_metadata: {
        full_name: `${teacherUser.firstName} ${teacherUser.lastName}`,
      },
    });

    if (!teacherError && teacherData?.user?.id) {
      await supabase.from("profiles").insert({
        id: teacherData.user.id,
        username: teacherUser.username,
        role: "teacher",
      });

      createdUsers.push({
        name: `${teacherUser.firstName} ${teacherUser.lastName}`,
        username: teacherUser.username,
        password: teacherUser.password,
        role: "teacher",
        userId: teacherData.user.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${createdUsers.length} fake users`,
        users: createdUsers,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
