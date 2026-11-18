import time
from typing import Dict, List, Any, Optional
from .base import BaseProcessor, ProcessorMetadata, ProcessingResult
from .trust import TrustRecalculator
from .bridge_synthesis import CompanyBridgeSynthesizer
from .synergy import SkillSynergyProcessor
from .knn_trajectory import KNNTrajectoryProcessor
from .centrality import CentralityProcessor
from .structural_holes import StructuralHolesProcessor
from .ev import EVProcessor
from .delta_ev import DeltaEVProcessor


class RecalculationRegistry:
    """
    Central modular registry for graph recalculations, topology inference, and analytical pipelines.
    """

    DEFAULT_ORDER = [
        "trust",
        "bridge_synthesis",
        "synergy",
        "knn_trajectory",
        "centrality",
        "structural_holes",
        "ev",
        "delta_ev",
    ]

    def __init__(self):
        self._processors: Dict[str, BaseProcessor] = {}
        self._register_defaults()

    def _register_defaults(self):
        self.register(TrustRecalculator())
        self.register(CompanyBridgeSynthesizer())
        self.register(SkillSynergyProcessor())
        self.register(KNNTrajectoryProcessor())
        self.register(CentralityProcessor())
        self.register(StructuralHolesProcessor())
        self.register(EVProcessor())
        self.register(DeltaEVProcessor())

    def register(self, processor: BaseProcessor):
        self._processors[processor.id] = processor

    def get(self, processor_id: str) -> Optional[BaseProcessor]:
        return self._processors.get(processor_id)

    def list_metadata(self) -> List[ProcessorMetadata]:
        return [p.get_metadata() for p in self._processors.values()]

    def run_processor(
        self,
        processor_id: str,
        db_conn,
        user_id: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> ProcessingResult:
        processor = self.get(processor_id)
        if not processor:
            raise ValueError(
                f"Unknown processor: '{processor_id}'. Available: {list(self._processors.keys())}"
            )
        return processor.run(db_conn, user_id, params)

    def run_pipeline(
        self,
        db_conn,
        user_id: str,
        processor_ids: Optional[List[str]] = None,
        params_map: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Runs an ordered sequence of recalculation processors and commits updates to SQLite."""
        start_time = time.time()
        requested = processor_ids or self.DEFAULT_ORDER
        # Preserve topological execution order when running multiple dependent modules
        order = [pid for pid in self.DEFAULT_ORDER if pid in requested] + [
            pid for pid in requested if pid not in self.DEFAULT_ORDER
        ]
        params_map = params_map or {}

        results: List[ProcessingResult] = []
        total_nodes_updated = 0
        total_edges_updated = 0

        for pid in order:
            if pid not in self._processors:
                continue
            proc_params = params_map.get(pid, {})
            res = self.run_processor(pid, db_conn, user_id, proc_params)
            results.append(res)
            total_nodes_updated += res.nodes_updated
            total_edges_updated += res.edges_updated

        elapsed = (time.time() - start_time) * 1000

        return {
            "status": "completed",
            "pipeline_processors_executed": [r.processor_id for r in results],
            "total_execution_time_ms": round(elapsed, 2),
            "total_nodes_updated": total_nodes_updated,
            "total_edges_updated": total_edges_updated,
            "results": [r.dict() for r in results],
        }


registry = RecalculationRegistry()
