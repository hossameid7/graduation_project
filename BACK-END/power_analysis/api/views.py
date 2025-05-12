from asgiref.sync import async_to_sync
import asyncio
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Q
from django.utils.dateparse import parse_date
from .models import Transformer, TransformerMeasurement, CustomUser, SupportSession, SupportMessage, AdminNotification, AIConversation, AIMessage
from .serializers import (
    TransformerSerializer, 
    TransformerMeasurementSerializer, 
    UserSerializer,
    UserSignupSerializer,
    SupportSessionSerializer,
    SupportMessageSerializer,
    AdminNotificationSerializer,
    AIConversationSerializer,
    AIMessageSerializer
)
import logging
from django.contrib.auth import update_session_auth_hash
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework_simplejwt.tokens import RefreshToken
from .chat_model import ChatModel
from .throttles import ChatRateThrottle

logger = logging.getLogger(__name__)

class TransformerViewSet(viewsets.ModelViewSet):
    serializer_class = TransformerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Only return the transformers that belong to the current user."""
        return Transformer.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Create a new transformer with form data."""
        name = request.data.get('name')
        if not name:
            return Response(
                {'error': 'Transformer name is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data={'name': name})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, 
            status=status.HTTP_201_CREATED, 
            headers=headers
        )

    def perform_create(self, serializer):
        """Automatically associate the transformer with the current user."""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'])
    def email_report(self, request):
        """Handle HTML report email sending."""
        from django.core.mail import EmailMultiAlternatives
        from django.conf import settings
        from django.utils import timezone
        from datetime import datetime

        try:
            transformer_id = request.data.get('transformerId')
            html_content = request.data.get('htmlContent')

            if not transformer_id or not html_content:
                return Response(
                    {'error': 'Transformer ID and HTML content are required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            transformer = Transformer.objects.get(id=transformer_id, user=request.user)
            
            # Create email
            subject = f'Transformer Status Report - {transformer.name}'
            from_email = settings.DEFAULT_FROM_EMAIL
            to_email = request.user.email
            print(f"Email sent to {to_email} with subject: {subject}")
            # Create text content as fallback
            text_content = f'Transformer Status Report for {transformer.name}\nGenerated on: {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}'

            # Create email message
            msg = EmailMultiAlternatives(subject, text_content, from_email, [to_email])
            msg.attach_alternative(html_content, "text/html")
            
            # Send email
            msg.send()

            return Response({'message': 'Report sent successfully'})
            
        except Transformer.DoesNotExist:
            return Response(
                {'error': 'Transformer not found or access denied'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error sending report: {str(e)}")
            return Response(
                {'error': f'Failed to send report: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class TransformerMeasurementViewSet(viewsets.ModelViewSet):
    serializer_class = TransformerMeasurementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get measurements with filtering and search capabilities."""
        queryset = TransformerMeasurement.objects.filter(transformer__user=self.request.user)

        # Search by transformer name
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(transformer__name__icontains=search)

        # Date range filtering
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            date = parse_date(start_date)
            if date:
                queryset = queryset.filter(timestamp__date__gte=date)
        if end_date:
            date = parse_date(end_date)
            if date:
                queryset = queryset.filter(timestamp__date__lte=date)

        # Gas type filtering
        gases = self.request.query_params.get('gases', '').split(',')
        gas_filters = Q()
        for gas in gases:
            if gas:
                gas_filters |= Q(**{f"{gas}__gt": 0})
        if gases and gases[0]:  # Only apply if there are gas filters
            queryset = queryset.filter(gas_filters)

        # Ordering
        ordering = self.request.query_params.get('ordering', '-timestamp')
        if ordering and ordering.replace('-', '') in ['timestamp', 'h2', 'co', 'c2h2', 'c2h4', 'fdd', 'rul']:
            queryset = queryset.order_by(ordering)

        return queryset

    def create(self, request, *args, **kwargs):
        """Create a new measurement with additional error handling."""
        try:
            logger.info(f"Received measurement data: {request.data}")
            
            # Validate transformer access
            transformer_id = request.data.get('transformer')
            try:
                transformer = Transformer.objects.get(id=transformer_id, user=request.user)
            except Transformer.DoesNotExist:
                return Response(
                    {'error': 'Invalid transformer or access denied'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create serializer and validate
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # Save measurement
            instance = serializer.save(transformer=transformer)
            
            # Log the results
            logger.info(f"Measurement created successfully. FDD: {instance.fdd}, RUL: {instance.rul}")
            
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            logger.error(f"Error creating measurement: {str(e)}")
            return Response(
                {'error': f'Failed to create measurement: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# authentication (login,signup)

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    serializer = UserSignupSerializer(data=request.data)
    if serializer.is_valid():
        try:
            user = serializer.save()
            
            # Log the user in
            from django.contrib.auth import login as auth_login
            auth_login(request, user)
            
            # Return user data using the UserSerializer for consistency
            user_serializer = UserSerializer(user)
            return Response({
                'message': 'User created successfully',
                'user': user_serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {'error': 'Failed to create user', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username_or_email = request.data.get('username')
    password = request.data.get('password')
    
    if not username_or_email or not password:
        return Response(
            {'error': 'Username/email and password are required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = CustomUser.objects.get(Q(username=username_or_email) | Q(email=username_or_email))
        if user.check_password(password):
            from django.contrib.auth import login as auth_login
            auth_login(request, user)
            
            # Ensure CSRF token is set
            from django.middleware.csrf import get_token
            get_token(request)
            
            # Use the serializer for consistent field naming
            serializer = UserSerializer(user)
            return Response({
                'user': serializer.data
            })
        else:
            return Response(
                {'error': 'Invalid credentials'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
    except CustomUser.DoesNotExist:
        return Response(
            {'error': 'User not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(['POST'])
def logout(request):
    from django.contrib.auth import logout as auth_logout
    auth_logout(request)
    return Response({'message': 'Successfully logged out'})

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def profile(request):
    user = request.user
    
    if request.method == 'GET':
        serializer = UserSerializer(user)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        # Log received data for debugging
        logger.debug(f"Profile update received data: {request.data}")
        
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.debug(f"Profile updated successfully: {serializer.data}")
            return Response(serializer.data)
        else:
            logger.error(f"Profile update validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    elif request.method == 'DELETE':
        user.delete()
        return Response({'message': 'Account deleted successfully'}, 
                      status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change user password."""
    if not request.data.get('current_password'):
        return Response({'detail': 'Current password is required'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    if not request.data.get('new_password'):
        return Response({'detail': 'New password is required'}, 
                       status=status.HTTP_400_BAD_REQUEST)
        
    user = request.user
    if not user.check_password(request.data['current_password']):
        return Response({'detail': 'Current password is incorrect'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    user.set_password(request.data['new_password'])
    user.save()
    update_session_auth_hash(request, user)  # Keep user logged in
    return Response({'detail': 'Password changed successfully'})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Delete user account."""
    user = request.user
    user.delete()
    return Response({'detail': 'Account deleted successfully'}, 
                   status=status.HTTP_204_NO_CONTENT)

# Support Views
class SupportSessionViewSet(viewsets.ModelViewSet):
    serializer_class = SupportSessionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return SupportSession.objects.all()
        return SupportSession.objects.filter(user=user)
    
    def create(self, request, *args, **kwargs):
        """Override create to automatically set the user field."""
        # Add user to the request data
        data = request.data.copy()
        data['user'] = request.user.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        session = self.get_object()
        session.is_resolved = True
        session.save()
        return Response({'status': 'Support session resolved'})
    
    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        session = self.get_object()
        session.is_resolved = False
        session.save()
        return Response({'status': 'Support session reopened'})

class SupportMessageViewSet(viewsets.ModelViewSet):
    serializer_class = SupportMessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return SupportMessage.objects.filter(
            Q(session__user=self.request.user) | Q(sender=self.request.user)
        ).distinct()
    
    def create(self, request, *args, **kwargs):
        """Override create to automatically set the sender field."""
        # Add sender to the request data
        data = request.data.copy()
        data['sender'] = request.user.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)
        session = message.session
        
        # Create notifications based on sender type
        if self.request.user.is_staff:
            # If admin sends a message, create notification for the user
            AdminNotification.objects.create(
                user=session.user,
                session=session,
                message=message,
                is_for_admin=False  # This is for regular user, not admin
            )
        else:
            # If user sends a message, create notifications for all admins
            admins = CustomUser.objects.filter(is_staff=True, is_active=True)
            for admin in admins:
                AdminNotification.objects.create(
                    user=admin,
                    session=session,
                    message=message,
                    is_for_admin=True  # This is for admin
                )
        
        # Mark notifications as read for the sender
        if self.request.user.is_staff:
            # If the sender is an admin, mark all admin notifications as read
            AdminNotification.objects.filter(
                session=session,
                user=self.request.user,
                is_read=False,
                is_for_admin=True
            ).update(is_read=True)
            
            # Mark all previous notifications for this session as read
            AdminNotification.objects.filter(
                session=session,
                user=self.request.user,
                is_read=False,
                is_for_admin=True
            ).update(is_read=True)
            
            # Also mark all messages in this session as read by the admin
            SupportMessage.objects.filter(
                session=session,
                is_read=False, 
                sender=session.user  # Only mark user's messages as read
            ).update(is_read=True)
        else:
            # If the sender is a user, mark all user notifications as read
            AdminNotification.objects.filter(
                session=session,
                user=self.request.user,
                is_read=False,
                is_for_admin=False
            ).update(is_read=True)
            
            # Also mark all messages in this session as read by the user
            SupportMessage.objects.filter(
                session=session,
                is_read=False, 
                sender__is_staff=True  # Only mark admin's messages as read
            ).update(is_read=True)
    
    @action(detail=False, methods=['post'])
    def mark_session_read(self, request):
        """Mark all messages in a session as read."""
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({'error': 'Session ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Get the session
            session = SupportSession.objects.get(pk=session_id)
            
            # If user is admin, mark all messages from the user as read
            if request.user.is_staff:
                # Only mark user's messages as read
                SupportMessage.objects.filter(
                    session=session,
                    is_read=False,
                    sender=session.user
                ).update(is_read=True)
                
                # Mark all notifications for this session as read
                AdminNotification.objects.filter(
                    session=session,
                    user=request.user,
                    is_read=False,
                    is_for_admin=True
                ).update(is_read=True)
            else:
                # If user is not admin, mark all admin messages as read
                SupportMessage.objects.filter(
                    session=session,
                    is_read=False,
                    sender__is_staff=True
                ).update(is_read=True)
                
                # Mark all user notifications for this session as read
                AdminNotification.objects.filter(
                    session=session,
                    user=request.user,
                    is_read=False,
                    is_for_admin=False
                ).update(is_read=True)
                
            return Response({'status': 'Messages marked as read'})
        except SupportSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

class AdminNotificationViewSet(viewsets.ModelViewSet):
    serializer_class = AdminNotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Admin users see admin notifications, regular users see user notifications
        if self.request.user.is_staff:
            return AdminNotification.objects.filter(user=self.request.user, is_for_admin=True)
        else:
            return AdminNotification.objects.filter(user=self.request.user, is_for_admin=False)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'Notification marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        # Admin users mark admin notifications as read, regular users mark user notifications as read
        if request.user.is_staff:
            AdminNotification.objects.filter(user=request.user, is_read=False, is_for_admin=True).update(is_read=True)
        else:
            AdminNotification.objects.filter(user=request.user, is_read=False, is_for_admin=False).update(is_read=True)
        return Response({'status': 'All notifications marked as read'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_notifications_count(request):
    # Admin users get count of admin notifications, regular users get count of user notifications
    if request.user.is_staff:
        count = AdminNotification.objects.filter(
            user=request.user,
            is_read=False,
            is_for_admin=True
        ).count()
    else:
        count = AdminNotification.objects.filter(
            user=request.user,
            is_read=False,
            is_for_admin=False
        ).count()
    
    return Response({'unread_count': count})

class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = AIConversationSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = [ChatRateThrottle]
    chat_model = ChatModel()

    def get_queryset(self):
        return AIConversation.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def chat(self, request):
        user_message = request.data.get('message')
        conversation_id = request.data.get('conversation_id')

        if not user_message:
            return Response(
                {'error': 'Message is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Get or create conversation
            if conversation_id:
                try:
                    conversation = AIConversation.objects.get(
                        id=conversation_id, 
                        user=request.user
                    )
                except AIConversation.DoesNotExist:
                    return Response(
                        {'error': 'Conversation not found'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                conversation = AIConversation.objects.create(user=request.user)

            # Save user message
            user_msg = AIMessage.objects.create(
                conversation=conversation,
                role='user',
                content=user_message
            )

            try:
                # Get conversation history
                history = [
                    {'role': msg.role, 'content': msg.content}
                    for msg in conversation.messages.all().order_by('-timestamp')[0:2]
                    # for msg in conversation.messages.all().order_by('timestamp')
                ]

                # Generate AI response asynchronously
                async def generate():
                    try:
                        return await self.chat_model.generate_response(user_message, history)
                    except asyncio.TimeoutError:
                        raise asyncio.TimeoutError("Model response timed out")
                    except Exception as e:
                        logger.error(f"Model generation error: {str(e)}")
                        raise

                ai_response = async_to_sync(generate)()

                # Save AI response
                ai_message = AIMessage.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=ai_response
                )

                # Update conversation timestamp
                conversation.save()

                return Response({
                    'conversation_id': conversation.id,
                    'message': AIMessageSerializer(ai_message).data,
                    'history': AIMessageSerializer(
                        conversation.messages.all().order_by('timestamp'),
                        many=True
                    ).data
                })

            except asyncio.TimeoutError:
                logger.error("Model generation timed out")
                user_msg.delete()
                return Response(
                    {
                        'error': 'Request timed out. Please try again.',
                        'detail': 'The model took too long to respond. This might be due to high server load.'
                    },
                    status=status.HTTP_504_GATEWAY_TIMEOUT
                )
            except Exception as e:
                logger.error(f"Model generation error: {str(e)}")
                user_msg.delete()
                return Response(
                    {
                        'error': 'Failed to generate response. Please try again.',
                        'detail': str(e) if settings.DEBUG else 'An unexpected error occurred.'
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            logger.error(f"Chat endpoint error: {str(e)}")
            return Response(
                {
                    'error': 'An unexpected error occurred',
                    'detail': str(e) if settings.DEBUG else 'The server encountered an error.'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )