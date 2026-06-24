"""
Importing this module ensures every model class is registered on db.metadata
before migrations or create_all() runs.
"""
from .user import User, SportProfile  # noqa: F401
from .court import Court  # noqa: F401
from .court_favorite import CourtFavorite  # noqa: F401
from .saved_player import SavedPlayer  # noqa: F401
from .court_appointment import CourtAppointment, AppointmentParticipant  # noqa: F401
from .court_checkin import CourtCheckIn  # noqa: F401
from .session_model import Session, SessionStatus, SessionBucket  # noqa: F401
from .game_invite import GameInvite, TimeProposal  # noqa: F401
from .availability import AvailabilitySlot  # noqa: F401
from .ai_match_log import AIMatchLog  # noqa: F401
