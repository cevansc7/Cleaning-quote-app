export const handleSupabaseResponse = ({ data, error }) => {
  if (error) {
    throw new Error(`Supabase Error [${error.code}]: ${error.message}`);
  }
  return data;
};

export const safeFetch = async (queryFn) => {
  try {
    const { data, error } = await queryFn();
    return handleSupabaseResponse({ data, error });
  } catch (err) {
    return {
      error: {
        message: err.message,
        code: err.code || 'UNKNOWN_ERROR'
      }
    };
  }
}; 