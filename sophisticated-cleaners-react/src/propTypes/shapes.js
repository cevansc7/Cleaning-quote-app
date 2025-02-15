import PropTypes from 'prop-types';

export const bookingShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  cleaning_date: PropTypes.instanceOf(Date).isRequired,
  status: PropTypes.oneOf(['pending', 'completed']).isRequired,
  details: PropTypes.shape({
    service_type: PropTypes.string,
    rooms: PropTypes.number
  })
});

export const checklistShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  task_name: PropTypes.string.isRequired,
  is_completed: PropTypes.bool.isRequired
}); 