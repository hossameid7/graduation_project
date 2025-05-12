from rest_framework.throttling import UserRateThrottle

class ChatRateThrottle(UserRateThrottle):
    rate = '20/minute'
    scope = 'chat'

    def allow_request(self, request, view):
        if view.__class__.__name__ == 'ChatViewSet':
            return super().allow_request(request, view)
        return True