import { supabase } from './supabase'

export type UserRole =
  | 'platform_owner'
  | 'admin'
  | 'teacher'
  | 'student'
  | 'parent'

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    console.error('Unable to load user role:', error)
    return null
  }

  return data.role as UserRole
}
