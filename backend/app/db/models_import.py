# Import all models here so that Base.metadata.create_all() has them registered
# This is also used by Alembic to autogenerate migrations

from app.modules.users.models.user import User  # noqa
from app.modules.users.models.role import Role  # noqa
from app.modules.auth.models.refresh_token import RefreshToken  # noqa
from app.modules.workspaces.models.workspace import Workspace  # noqa
from app.modules.workspaces.models.assignment import WorkspaceAssignment  # noqa
from app.modules.pipelines.models.pipeline import Pipeline  # noqa
from app.modules.pipelines.models.pipeline_run import PipelineRun  # noqa
from app.modules.pipelines.models.activity_run import ActivityRun  # noqa
from app.modules.pipelines.models.pipeline_schedule import PipelineSchedule  # noqa
from app.modules.sla.models.sla_config import SLAConfig  # noqa
from app.modules.sla.models.sla_incident import SLAIncident  # noqa
from app.modules.table_logs.models.table_log_mapping import TableLogMapping  # noqa
from app.modules.diagnostics.models.diagnostic import AIErrorDiagnostic  # noqa
