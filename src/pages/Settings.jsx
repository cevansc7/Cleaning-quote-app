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

            // Call the RPC function to delete the user
            const { data, error: deleteError } = await supabase.rpc('handle_user_deletion', {
                target_user_id: user.id
            });

            if (deleteError) throw deleteError;

            if (!data.success) {
                throw new Error(data.error || 'Failed to delete account');
            }

            // Sign out after successful deletion
            await signOut();
            navigate('/');
        } catch (error) {
            console.error('Error deleting account:', error);
            setError(error.message);
        } finally {
            setLoading(false);
            setShowConfirmation(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <nav className="bg-container border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="text-gold">Account Settings</div>
                        <button
                            onClick={() => navigate(-1)}
                            className="text-secondary hover:text-gold transition-colors"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-container rounded-lg shadow p-6 max-w-2xl mx-auto">
                    <h1 className="text-2xl font-bold text-gold mb-6">Account Settings</h1>

                    <div className="space-y-6">
                        {/* Account Information */}
                        <div>
                            <h2 className="text-xl text-primary mb-4">Account Information</h2>
                            <div className="space-y-2">
                                <p><span className="text-secondary">Email:</span> {user?.email}</p>
                                <p><span className="text-secondary">Name:</span> {profile?.name}</p>
                                <p><span className="text-secondary">Phone:</span> {profile?.phone}</p>
                                <p><span className="text-secondary">Role:</span> {profile?.role}</p>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="border-t border-border pt-6">
                            <h2 className="text-xl text-error mb-4">Danger Zone</h2>

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