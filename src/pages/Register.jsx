import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    role: 'client' // default role
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            phone: formData.phone,
            role: formData.role
          }
        }
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('No user data returned from signup');
      }

      // Create profile immediately
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          role: formData.role
        }])
        .select();

      if (profileError) {
        console.error('Error creating profile:', profileError);
        throw new Error('Failed to create profile: ' + profileError.message);
      }

      // If registering as staff, create staff record immediately
      if (formData.role === 'staff') {
        const { error: staffError } = await supabase.rpc('add_staff_member', {
          user_email: formData.email,
          user_name: formData.name,
          staff_role: 'cleaner'
        });

        if (staffError) {
          console.error('Error creating staff record:', staffError);
          // Don't throw here, as the user account is already created
          // Just log the error and we'll try to fix it on next sign in
        }
      }

      // Store minimal registration data in localStorage for backup
      localStorage.setItem('pendingProfile', JSON.stringify({
        id: authData.user.id,
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        role: formData.role
      }));

      // Registration successful
      alert('Registration successful! Please check your email for verification. After verifying your email, you can log in to complete your profile setup.');
      navigate('/login');

    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="auth-container">
        <h2>Create Account</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              pattern="[0-9]{3}[0-9]{3}[0-9]{4}"
              placeholder="1234567890"
              className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Account Type</label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
            >
              <option value="client">Client</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn w-full bg-gold hover:bg-gold-dark text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="auth-link mt-4 text-center">
          Already have an account? <Link to="/login" className="text-gold hover:text-gold-dark">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Register; 