import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
'https://kdflhvxbmbjtsxyjldfx.supabase.co';
const supabaseKey = 'sb_publishable_RCVcEQmlOyiH_o8fC90VZw_K-ThUYKO';

export const supabase = createClient(supabaseUrl, supabaseKey)

