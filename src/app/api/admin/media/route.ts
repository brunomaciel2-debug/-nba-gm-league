import { createClient } from '@supabase/supabase-js'; 
import { revalidatePath } from 'next/cache'; 
import { NextResponse } from 'next/server'; 
 
const supabase = createClient( 
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
); 
