import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function CleaningChecklist({ booking, onComplete }) {
  const [checklist, setChecklist] = useState({});
  const [sections, setSections] = useState({});
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    if (booking?.details?.package === 'breatheEasy') {
      const initialSections = {
        preparation: {
          title: 'Initial Preparation',
          tasks: {
            initial_walkthrough: false,
            setup_equipment: false,
            review_requirements: false,
          }
        },
        common_areas: {
          title: 'Common Areas',
          tasks: {
            dust_surfaces: false,
            vacuum_floors: false,
            mop_floors: false,
            clean_windows: false,
            clean_mirrors: false,
            empty_trash: false,
            sanitize_doorknobs: false,
            clean_light_switches: false,
          }
        }
      };

      // Initialize all sections as expanded
      const initialExpandedSections = { preparation: true, common_areas: true };

      if (booking.details.rooms.bedrooms > 0) {
        initialSections.bedrooms = {
          title: `Bedrooms (${booking.details.rooms.bedrooms})`,
          tasks: {
            bedrooms_dusted: false,
            bedrooms_vacuumed: false,
            beds_made: false,
            bedroom_windows_cleaned: false,
          }
        };
        initialExpandedSections.bedrooms = true;
      }

      if (booking.details.rooms.bathrooms > 0) {
        initialSections.bathrooms = {
          title: `Bathrooms (${booking.details.rooms.bathrooms})`,
          tasks: {
            bathrooms_sanitized: false,
            toilets_cleaned: false,
            showers_cleaned: false,
            bathroom_sinks_cleaned: false,
            bathroom_mirrors_cleaned: false,
            bathroom_floors_mopped: false,
          }
        };
        initialExpandedSections.bathrooms = true;
      }

      if (booking.details.rooms.halfBathrooms > 0) {
        initialSections.half_bathrooms = {
          title: `Half Bathrooms (${booking.details.rooms.halfBathrooms})`,
          tasks: {
            half_bathrooms_sanitized: false,
            half_bathroom_toilets_cleaned: false,
            half_bathroom_sinks_cleaned: false,
            half_bathroom_mirrors_cleaned: false,
            half_bathroom_floors_mopped: false,
          }
        };
        initialExpandedSections.half_bathrooms = true;
      }

      if (booking.details.rooms.kitchens > 0) {
        initialSections.kitchen = {
          title: 'Kitchen',
          tasks: {
            kitchen_counters_cleaned: false,
            kitchen_appliances_cleaned: false,
            kitchen_sink_cleaned: false,
            kitchen_cabinets_wiped: false,
            kitchen_floor_mopped: false,
            kitchen_trash_emptied: false,
          }
        };
        initialExpandedSections.kitchen = true;
      }

      if (booking.details.rooms.livingRooms > 0) {
        initialSections.living_room = {
          title: 'Living Room',
          tasks: {
            living_room_dusted: false,
            living_room_vacuumed: false,
            living_room_windows_cleaned: false,
            living_room_furniture_cleaned: false,
          }
        };
        initialExpandedSections.living_room = true;
      }

      if (booking.details.rooms.bonusRooms > 0) {
        initialSections.bonus_room = {
          title: `Bonus Room (${booking.details.rooms.bonusRooms})`,
          tasks: {
            bonus_room_dusted: false,
            bonus_room_vacuumed: false,
            bonus_room_windows_cleaned: false,
          }
        };
        initialExpandedSections.bonus_room = true;
      }

      if (booking.details.rooms.laundryRooms > 0) {
        initialSections.laundry = {
          title: 'Laundry Room',
          tasks: {
            laundry_room_cleaned: false,
            washer_dryer_wiped: false,
            laundry_floor_mopped: false,
          }
        };
        initialExpandedSections.laundry = true;
      }

      if (booking.details.rooms.offices > 0) {
        initialSections.office = {
          title: `Office (${booking.details.rooms.offices})`,
          tasks: {
            office_dusted: false,
            office_vacuumed: false,
            office_windows_cleaned: false,
          }
        };
        initialExpandedSections.office = true;
      }

      initialSections.final = {
        title: 'Final Steps',
        tasks: {
          final_inspection: false,
          client_walkthrough: false,
        }
      };
      initialExpandedSections.final = true;

      setSections(initialSections);
      setExpandedSections(initialExpandedSections);

      // Combine all tasks into checklist
      const allTasks = {};
      Object.values(initialSections).forEach(section => {
        Object.assign(allTasks, section.tasks);
      });
      setChecklist(allTasks);

    } else if (booking?.details?.package === 'blockCleaning') {
      const blockSections = {
        preparation: {
          title: 'Initial Preparation',
          tasks: {
            initial_walkthrough: false,
            setup_equipment: false,
            review_requirements: false,
          }
        },
        cleaning: {
          title: 'Cleaning Tasks',
          tasks: {
            clean_assigned_areas: false,
            sanitize_surfaces: false,
            vacuum_floors: false,
            mop_floors: false,
            empty_trash: false,
          }
        },
        final: {
          title: 'Final Steps',
          tasks: {
            final_inspection: false,
            client_walkthrough: false,
          }
        }
      };

      setSections(blockSections);
      setExpandedSections({
        preparation: true,
        cleaning: true,
        final: true
      });

      // Combine all tasks into checklist
      const allTasks = {};
      Object.values(blockSections).forEach(section => {
        Object.assign(allTasks, section.tasks);
      });
      setChecklist(allTasks);
    }
  }, [booking]);

  const handleCheck = (item) => {
    setChecklist(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const handleComplete = async () => {
    if (!Object.values(checklist).every(Boolean)) {
      showNotification('Please complete all tasks before marking as completed', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'completed',
          completion_checklist: checklist,
          completed_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (error) throw error;

      showNotification('Booking marked as completed', 'success');
      onComplete?.();
    } catch (error) {
      console.error('Error completing booking:', error);
      showNotification('Error marking booking as complete', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getTaskLabel = (key) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const getSectionProgress = (tasks) => {
    const completedTasks = Object.entries(tasks).filter(([key, value]) => checklist[key]).length;
    return `${completedTasks}/${Object.keys(tasks).length}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-gold font-medium">Cleaning Checklist</h3>
        <button 
          className="text-secondary text-sm hover:text-gold"
          onClick={() => setChecklist(prev => {
            const allChecked = Object.values(prev).every(Boolean);
            return Object.keys(prev).reduce((acc, key) => ({
              ...acc,
              [key]: !allChecked
            }), {});
          })}
        >
          {Object.values(checklist).every(Boolean) ? 'Uncheck All' : 'Check All'}
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(sections).map(([sectionKey, section]) => (
          <div key={sectionKey} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(sectionKey)}
              className="w-full px-4 py-2 bg-container flex justify-between items-center hover:bg-container/80"
            >
              <span className="text-primary font-medium">{section.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-secondary text-sm">
                  {getSectionProgress(section.tasks)}
                </span>
                <svg
                  className={`w-5 h-5 transform transition-transform ${
                    expandedSections[sectionKey] ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            
            {expandedSections[sectionKey] && (
              <div className="p-4 space-y-2 bg-background">
                {Object.entries(section.tasks).map(([taskKey, _]) => (
                  <label 
                    key={taskKey}
                    className="flex items-center gap-2 p-2 hover:bg-container/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checklist[taskKey] || false}
                      onChange={() => handleCheck(taskKey)}
                      className="form-checkbox text-gold rounded border-border focus:ring-gold"
                    />
                    <span className="text-secondary">{getTaskLabel(taskKey)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleComplete}
        disabled={loading || !Object.values(checklist).every(Boolean)}
        className={`w-full py-2 px-4 rounded ${
          Object.values(checklist).every(Boolean)
            ? 'bg-success text-background hover:bg-success/90'
            : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? 'Marking as Complete...' : 'Mark as Completed'}
      </button>
    </div>
  );
}

export default CleaningChecklist; 