import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function StaffAssignment({ booking, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();
  const [assignedStaff, setAssignedStaff] = useState(booking.assigned_staff || []);
  const [availableStaff, setAvailableStaff] = useState([]);

  useEffect(() => {
    const fetchAvailableStaff = async () => {
      try {
        console.log('Fetching available staff...');
        const { data, error } = await supabase
          .from('staff')
          .select('*')
          .eq('status', 'active')
          .order('name');

        if (error) {
          console.error('Error fetching staff:', error);
          throw error;
        }

        console.log('Available staff:', data);
        setAvailableStaff(data || []);
      } catch (error) {
        console.error('Error in fetchAvailableStaff:', error);
        showNotification('Error loading staff members', 'error');
      }
    };

    fetchAvailableStaff();
  }, [showNotification]);

  const handleAssignStaff = async (staffId) => {
    try {
      setLoading(true);
      
      const updatedStaff = assignedStaff.includes(staffId)
        ? assignedStaff.filter(id => id !== staffId)
        : [...assignedStaff, staffId];

      const { error } = await supabase
        .from('bookings')
        .update({ 
          assigned_staff: updatedStaff,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (error) throw error;

      setAssignedStaff(updatedStaff);
      showNotification('Staff assignment updated', 'success');
      if (onUpdate) onUpdate();

    } catch (error) {
      console.error('Error assigning staff:', error);
      showNotification('Error updating staff assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h3 className="text-gold font-semibold mb-2">Assigned Staff</h3>
      <div className="space-y-2">
        {availableStaff.length === 0 ? (
          <p className="text-secondary text-sm">No staff members available</p>
        ) : (
          availableStaff.map(member => (
            <div
              key={member.id}
              className="flex items-center justify-between p-2 rounded bg-background"
            >
              <div>
                <p className="text-primary">{member.name}</p>
                <p className="text-secondary text-sm">{member.role}</p>
              </div>
              <button
                onClick={() => handleAssignStaff(member.id)}
                className={`px-3 py-1 rounded text-sm ${
                  assignedStaff.includes(member.id)
                    ? 'bg-gold/20 text-gold'
                    : 'bg-secondary/20 text-secondary'
                }`}
                disabled={loading}
              >
                {assignedStaff.includes(member.id) ? 'Unassign' : 'Assign'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default StaffAssignment; 