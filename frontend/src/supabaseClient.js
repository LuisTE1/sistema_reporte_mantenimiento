import { createClient } from '@supabase/supabase-js'

// Estas son las credenciales reales de tu proyecto "Sistema Mantenimiento" en Supabase.
const supabaseUrl = 'https://vbbrhzclzrpwzlbqmsvk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiYnJoemNsenJwd3psYnFtc3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMDk2MTUsImV4cCI6MjEwMzg4NTYxNX0.AMF8Lwb2GkrsF6gvF_rkMItF_-GmXLB5A9aIg7m6K4M'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
