from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
import time

class ProcessorMetadata(BaseModel):
    id: str
    name: str
    category: str
    description: str
    parameters_schema: Dict[str, Any] = Field(default_factory=dict)

class ProcessingResult(BaseModel):
    processor_id: str
    status: str
    execution_time_ms: float
    nodes_updated: int = 0
    edges_updated: int = 0
    metrics: Dict[str, Any] = Field(default_factory=dict)
    message: str = ""

class BaseProcessor(ABC):
    """
    Abstract base class for all modular graph recalculations and processing updates.
    """
    id: str = "base"
    name: str = "Base Processor"
    category: str = "General"
    description: str = "Base recalculation processor"
    parameters_schema: Dict[str, Any] = {}

    def get_metadata(self) -> ProcessorMetadata:
        return ProcessorMetadata(
            id=self.id,
            name=self.name,
            category=self.category,
            description=self.description,
            parameters_schema=self.parameters_schema
        )

    @abstractmethod
    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        """
        Execute the recalculation logic, optionally updating SQLite tables and returning metrics.
        """
        pass
