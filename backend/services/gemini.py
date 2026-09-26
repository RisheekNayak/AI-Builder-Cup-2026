class GeminiService:
    def __init__(self, model_name: str):
        self.model_name = model_name

    async def generate_response(self, prompt: str, context: str) -> str:
        """
        Generate AI response using Gemini model.
        """
        # TODO: Implement Vertex AI Generative Model call
        return "AI response"
