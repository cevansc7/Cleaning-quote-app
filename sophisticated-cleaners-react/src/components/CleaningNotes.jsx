import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function CleaningNotes({ bookingId }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchNotes();
  }, [bookingId]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('cleaning_notes')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      showNotification('Error loading notes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('cleaning_notes')
        .insert([{
          booking_id: bookingId,
          staff_id: user.id,
          note_text: newNote.trim()
        }]);

      if (error) throw error;

      setNewNote('');
      await fetchNotes();
      showNotification('Note added successfully', 'success');
    } catch (error) {
      console.error('Error adding note:', error);
      showNotification('Error adding note', 'error');
    }
  };

  if (loading) {
    return <div className="text-secondary text-sm">Loading notes...</div>;
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="flex-1 bg-input border border-border rounded px-3 py-2 text-primary"
          onKeyPress={(e) => e.key === 'Enter' && addNote()}
        />
        <button
          onClick={addNote}
          className="btn-secondary whitespace-nowrap"
        >
          Add Note
        </button>
      </div>

      <div className="space-y-2">
        {notes.map(note => (
          <div 
            key={note.id}
            className="bg-[#2a2a2a] border border-border rounded p-3"
          >
            <p className="text-primary">{note.note_text}</p>
            <p className="text-sm text-secondary mt-1">
              {new Date(note.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CleaningNotes; 