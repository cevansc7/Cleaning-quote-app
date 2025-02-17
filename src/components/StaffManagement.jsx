import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';
import { addStaffMember } from '../utils/staffUtils';

function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'cleaner'
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          profiles:user_id (
            name,
            phone
          )
        `)
        .order('name');

      if (error) throw error;

      // Map the data to include profile information
      const staffWithProfiles = data?.map(staff => ({
        ...staff,
        name: staff.profiles?.name || staff.name,
        phone: staff.profiles?.phone || staff.phone
      })) || [];

      setStaff(staffWithProfiles);
    } catch (error) {
      console.error('Error fetching staff:', error);
      showNotification('Error loading staff members', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      const result = await addStaffMember(newStaff.email, newStaff.name, newStaff.phone, newStaff.role);
      if (!result.success) {
        throw new Error(result.error);
      }

      showNotification('Staff member added successfully', 'success');
      // Reset form
      setNewStaff({
        name: '',
        email: '',
        phone: '',
        role: 'cleaner'
      });
      // Refresh staff list
      await fetchStaff();
    } catch (error) {
      console.error('Error adding staff:', error);
      showNotification('Failed to add staff member: ' + error.message, 'error');
    }
  };

  const handleUpdateStatus = async (staffId, newStatus) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ status: newStatus })
        .eq('id', staffId);

      if (error) throw error;

      setStaff(staff.map(s =>
        s.id === staffId ? { ...s, status: newStatus } : s
      ));
      showNotification('Staff status updated', 'success');
    } catch (error) {
      console.error('Error updating staff status:', error);
      showNotification('Error updating staff status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-container border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gold mb-4">Add New Staff Member</h2>
        <form onSubmit={handleAddStaff} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="name" className="text-secondary">Name</label>
              <input
                type="text"
                id="name"
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                required
                className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email" className="text-secondary">Email</label>
              <input
                type="email"
                id="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                required
                className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="phone" className="text-secondary">Phone</label>
              <input
                type="tel"
                id="phone"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                required
                className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
              />
            </div>
            <div className="form-group">
              <label htmlFor="role" className="text-secondary">Role</label>
              <select
                id="role"
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
              >
                <option value="cleaner">Cleaner</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="btn w-full"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Staff Member'}
          </button>
        </form>
      </div>

      <div className="bg-container border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gold mb-4">Staff Members</h2>
        {loading ? (
          <p className="text-secondary">Loading staff...</p>
        ) : staff.length === 0 ? (
          <p className="text-secondary">No staff members found</p>
        ) : (
          <div className="space-y-4">
            {staff.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-background rounded-lg"
              >
                <div>
                  <h3 className="font-semibold text-primary">{member.name}</h3>
                  <p className="text-secondary text-sm">{member.email}</p>
                  <p className="text-secondary text-sm">{member.phone}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 rounded text-sm ${member.status === 'active' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
                    }`}>
                    {member.status}
                  </span>
                  <button
                    onClick={() => handleUpdateStatus(member.id, member.status === 'active' ? 'inactive' : 'active')}
                    className="text-secondary hover:text-gold transition-colors"
                  >
                    {member.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StaffManagement; 