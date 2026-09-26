from pydantic import BaseModel
from typing import List, Optional

class Item(BaseModel):
    description: str
    hs_code: str
    quantity: int
    value: float

class Shipment(BaseModel):
    shipment_id: str
    destination_country: str
    items: List[Item]
    total_value: float
