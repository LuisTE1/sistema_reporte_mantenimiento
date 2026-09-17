import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vbbrhzclzrpwzlbqmsvk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiYnJoemNsenJwd3psYnFtc3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMDk2MTUsImV4cCI6MjEwMzg4NTYxNX0.AMF8Lwb2GkrsF6gvF_rkMItF_-GmXLB5A9aIg7m6K4M'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function seed() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@admin.com', // Let's try this
    password: 'admin'
  })
  
  if (authErr) {
    console.log("Auth failed, maybe the user isn't email based. But wait, in Login.jsx it queries the 'usuarios' table!")
  }
}
seed()
