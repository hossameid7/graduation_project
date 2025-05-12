from rest_framework import serializers
from .models import Transformer, TransformerMeasurement, CustomUser, SupportSession, SupportMessage, AdminNotification, AIMessage, AIConversation

class UserSerializer(serializers.ModelSerializer):
    firstName = serializers.CharField(source='first_name', required=False, allow_blank=True)
    lastName = serializers.CharField(source='last_name', required=False, allow_blank=True)
    
    class Meta:
        model = CustomUser
        fields = ('id', 'username', 'email', 'firstName', 'lastName', 'phone', 'dateOfBirth', 'company', 'is_staff')
        read_only_fields = ('id', 'is_staff')
        extra_kwargs = {'password': {'write_only': True}}

class UserSignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    firstName = serializers.CharField(source='first_name', required=False, allow_blank=True)
    lastName = serializers.CharField(source='last_name', required=False, allow_blank=True)

    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'password', 'firstName', 'lastName', 'phone', 'dateOfBirth', 'company')

    def create(self, validated_data):
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=first_name,
            last_name=last_name,
            phone=validated_data.get('phone', ''),
            dateOfBirth=validated_data.get('dateOfBirth'),
            company=validated_data.get('company', '')
        )
        return user

class TransformerSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.id')
    
    class Meta:
        model = Transformer
        fields = ['id', 'name', 'user']
    
class TransformerMeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransformerMeasurement
        fields = '__all__'

class SupportMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(),
        required=False  # Make sender optional so it can be set in the view
    )
    
    class Meta:
        model = SupportMessage
        fields = ['id', 'session', 'sender', 'sender_name', 'content', 'timestamp', 'is_read']
        read_only_fields = ['id', 'timestamp', 'sender_name']
    
    def get_sender_name(self, obj):
        return obj.sender.username

class SupportSessionSerializer(serializers.ModelSerializer):
    messages = SupportMessageSerializer(many=True, read_only=True)
    user_name = serializers.SerializerMethodField()
    user = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(),
        required=False  # Make user optional so it can be set in the view
    )
    
    class Meta:
        model = SupportSession
        fields = ['id', 'user', 'user_name', 'title', 'created_at', 'updated_at', 'is_resolved', 'messages']
        read_only_fields = ['id', 'created_at', 'updated_at', 'user_name']
    
    def get_user_name(self, obj):
        return obj.user.username

class AdminNotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    message_content = serializers.SerializerMethodField()
    session_title = serializers.SerializerMethodField()
    
    class Meta:
        model = AdminNotification
        fields = ['id', 'user', 'session', 'message', 'created_at', 'is_read', 
                 'sender_name', 'message_content', 'session_title']
        read_only_fields = ['id', 'created_at', 'sender_name', 'message_content', 'session_title']
    
    def get_sender_name(self, obj):
        return obj.message.sender.username
    
    def get_message_content(self, obj):
        return obj.message.content
    
    def get_session_title(self, obj):
        return obj.session.title or f"Support request from {obj.session.user.username}"

class AIMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIMessage
        fields = ['id', 'role', 'content', 'timestamp']

class AIConversationSerializer(serializers.ModelSerializer):
    messages = AIMessageSerializer(many=True, read_only=True)
    
    class Meta:
        model = AIConversation
        fields = ['id', 'created_at', 'updated_at', 'messages']