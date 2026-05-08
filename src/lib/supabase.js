import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lzdgrzlpdljbiahztlmm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZGdyemxwZGxqYmlhaHp0bG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMjY4NzQsImV4cCI6MjA5MzgwMjg3NH0.tFo885BeGOU4ACIiz_qFg-teXdx1lcsqxKGDu6uYBbI'

export const supabase = createClient(supabaseUrl, supabaseKey)