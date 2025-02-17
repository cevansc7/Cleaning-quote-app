import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

function Settings() {
    const navigate = useNavigate();
    const { user, profile, signOut } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleDeleteAccount = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!user?.id) {
                throw new Error('No user found. Please sign in again.');
            }

            // Call the RPC function to delete the user
            const { data, error: deleteError } = await supabase.rpc('handle_user_deletion', {
                target_user_id: user.id
            });

            if (deleteError) {
                console.error('Delete error:', deleteError);
                throw new Error(deleteError.message || 'Failed to delete account');
            }

            if (!data?.success) {
                console.error('Delete failed:', data);
                throw new Error(data?.error || 'Failed to delete account');
            }

            // Sign out after successful deletion
            await signOut();
            navigate('/', { replace: true });
        } catch (error) {
            console.error('Error deleting account:', error);
            setError(error.message || 'An unexpected error occurred while deleting your account');
            setShowConfirmation(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-2xl font-bold mb-6">Account Settings</h2>

                        <div className="space-y-6">
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Account</h3>
                                <p className="text-gray-500 mb-4">
                                    Once you delete your account, all of your data will be permanently removed.
                                    This action cannot be undone.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-error/10 border border-error text-error px-4 py-2 rounded mb-4">
                                    {error}
                                </div>
                            )}

                            {!showConfirmation ? (
                                <button
                                    onClick={() => setShowConfirmation(true)}
                                    className="bg-error/10 hover:bg-error/20 text-error px-4 py-2 rounded transition-colors"
                                >
                                    Delete Account
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-error">
                                        Are you sure you want to delete your account? This action cannot be undone.
                                        All your data will be permanently deleted.
                                    </p>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleDeleteAccount}
                                            disabled={loading}
                                            className="bg-error hover:bg-error/90 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                                        >
                                            {loading ? 'Deleting...' : 'Yes, Delete My Account'}
                                        </button>
                                        <button
                                            onClick={() => setShowConfirmation(false)}
                                            disabled={loading}
                                            className="bg-secondary/10 hover:bg-secondary/20 text-secondary px-4 py-2 rounded transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Settings; 