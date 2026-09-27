from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime

class LineItem(BaseModel):
    description: str
    hs_code: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    total_value: Optional[float] = None
    weight: Optional[float] = None
    unit: Optional[str] = None

class ExtractedData(BaseModel):
    seller_name: Optional[str] = None
    seller_address: Optional[str] = None
    seller_country: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_address: Optional[str] = None
    buyer_country: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    line_items: List[LineItem] = []
    total_value: Optional[float] = None
    currency: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    payment_terms: Optional[str] = None

class Shipment(BaseModel):
    id: str
    filename: str
    status: Literal['uploaded','extracting','analyzing','complete','error']
    extracted_data: Optional[ExtractedData] = None
    risk_report: Optional[dict] = None
    company_id: Optional[str] = None
    created_at: datetime
