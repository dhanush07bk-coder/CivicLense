export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      public_profiles: {
        Row: {
          id: string;
          full_name: string;
          role: 'Citizen' | 'Volunteer' | 'Coordinator';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: 'Citizen' | 'Volunteer' | 'Coordinator';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: 'Citizen' | 'Volunteer' | 'Coordinator';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      public_civic_issues: {
        Row: {
          id: string;
          report_code: string;
          title: string;
          description: string;
          category:
            | 'Waste and Sanitation'
            | 'Public Space Damage'
            | 'Infrastructure / Electrical Hazard'
            | 'Public Obstruction'
            | 'Other Civic Issue';
          state: string;
          district: string;
          city: string;
          locality: string;
          pin_code: string;
          country_code: 'IN';
          latitude: number | null;
          longitude: number | null;
          image_path: string | null;
          reporter_id: string | null;
          is_anonymous: boolean;
          status:
            | 'Submitted'
            | 'Under Verification'
            | 'Verified'
            | 'Action in Progress'
            | 'Resolved'
            | 'Recurring'
            | 'Rejected';
          safety_advisory_shown: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_code: string;
          title: string;
          description: string;
          category:
            | 'Waste and Sanitation'
            | 'Public Space Damage'
            | 'Infrastructure / Electrical Hazard'
            | 'Public Obstruction'
            | 'Other Civic Issue';
          state: string;
          district: string;
          city: string;
          locality: string;
          pin_code: string;
          country_code?: 'IN';
          latitude?: number | null;
          longitude?: number | null;
          image_path?: string | null;
          reporter_id?: string | null;
          is_anonymous?: boolean;
          status?:
            | 'Submitted'
            | 'Under Verification'
            | 'Verified'
            | 'Action in Progress'
            | 'Resolved'
            | 'Recurring'
            | 'Rejected';
          safety_advisory_shown?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          report_code?: string;
          title?: string;
          description?: string;
          category?:
            | 'Waste and Sanitation'
            | 'Public Space Damage'
            | 'Infrastructure / Electrical Hazard'
            | 'Public Obstruction'
            | 'Other Civic Issue';
          state?: string;
          district?: string;
          city?: string;
          locality?: string;
          pin_code?: string;
          country_code?: 'IN';
          latitude?: number | null;
          longitude?: number | null;
          image_path?: string | null;
          reporter_id?: string | null;
          is_anonymous?: boolean;
          status?:
            | 'Submitted'
            | 'Under Verification'
            | 'Verified'
            | 'Action in Progress'
            | 'Resolved'
            | 'Recurring'
            | 'Rejected';
          safety_advisory_shown?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'public_civic_issues_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      public_issue_timeline: {
        Row: {
          id: string;
          issue_id: string;
          previous_status: string | null;
          new_status:
            | 'Submitted'
            | 'Under Verification'
            | 'Verified'
            | 'Action in Progress'
            | 'Resolved'
            | 'Recurring'
            | 'Rejected';
          action_description: string;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          issue_id: string;
          previous_status?: string | null;
          new_status:
            | 'Submitted'
            | 'Under Verification'
            | 'Verified'
            | 'Action in Progress'
            | 'Resolved'
            | 'Recurring'
            | 'Rejected';
          action_description: string;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          issue_id?: string;
          previous_status?: string | null;
          new_status?:
            | 'Submitted'
            | 'Under Verification'
            | 'Verified'
            | 'Action in Progress'
            | 'Resolved'
            | 'Recurring'
            | 'Rejected';
          action_description?: string;
          changed_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'public_issue_timeline_issue_id_fkey';
            columns: ['issue_id'];
            isOneToOne: false;
            referencedRelation: 'public_civic_issues';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_issue_timeline_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      public_community_initiatives: {
        Row: {
          id: string;
          title: string;
          description: string;
          country_code: 'IN';
          state: string;
          district: string;
          city: string;
          locality: string;
          pin_code: string;
          latitude: number | null;
          longitude: number | null;
          event_date: string;
          start_time: string;
          end_time: string;
          capacity: number;
          coordinator_id: string | null;
          status: 'Open' | 'Completed' | 'Cancelled';
          cancellation_reason: string | null;
          linked_issue_ids: string[];
          cover_image_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          country_code?: 'IN';
          state: string;
          district: string;
          city: string;
          locality: string;
          pin_code: string;
          latitude?: number | null;
          longitude?: number | null;
          event_date: string;
          start_time: string;
          end_time: string;
          capacity: number;
          coordinator_id?: string | null;
          status?: 'Open' | 'Completed' | 'Cancelled';
          cancellation_reason?: string | null;
          linked_issue_ids?: string[];
          cover_image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          country_code?: 'IN';
          state?: string;
          district?: string;
          city?: string;
          locality?: string;
          pin_code?: string;
          latitude?: number | null;
          longitude?: number | null;
          event_date?: string;
          start_time?: string;
          end_time?: string;
          capacity?: number;
          coordinator_id?: string | null;
          status?: 'Open' | 'Completed' | 'Cancelled';
          cancellation_reason?: string | null;
          linked_issue_ids?: string[];
          cover_image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'public_community_initiatives_coordinator_id_fkey';
            columns: ['coordinator_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      public_volunteer_registrations: {
        Row: {
          id: string;
          initiative_id: string;
          user_id: string;
          registration_status: 'Registered' | 'Cancelled';
          attendance_status: 'Pending' | 'Attended' | 'Absent';
          registered_at: string;
        };
        Insert: {
          id?: string;
          initiative_id: string;
          user_id: string;
          registration_status?: 'Registered' | 'Cancelled';
          attendance_status?: 'Pending' | 'Attended' | 'Absent';
          registered_at?: string;
        };
        Update: {
          id?: string;
          initiative_id?: string;
          user_id?: string;
          registration_status?: 'Registered' | 'Cancelled';
          attendance_status?: 'Pending' | 'Attended' | 'Absent';
          registered_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'public_volunteer_registrations_initiative_id_fkey';
            columns: ['initiative_id'];
            isOneToOne: false;
            referencedRelation: 'public_community_initiatives';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_volunteer_registrations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      public_intervention_evidence: {
        Row: {
          id: string;
          issue_id: string;
          initiative_id: string | null;
          evidence_type: 'before' | 'after' | 'followup';
          image_path: string;
          submitted_by: string | null;
          verification_status: 'Pending' | 'Approved' | 'Rejected';
          verified_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          issue_id: string;
          initiative_id?: string | null;
          evidence_type: 'before' | 'after' | 'followup';
          image_path: string;
          submitted_by?: string | null;
          verification_status?: 'Pending' | 'Approved' | 'Rejected';
          verified_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          issue_id?: string;
          initiative_id?: string | null;
          evidence_type?: 'before' | 'after' | 'followup';
          image_path?: string;
          submitted_by?: string | null;
          verification_status?: 'Pending' | 'Approved' | 'Rejected';
          verified_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'public_intervention_evidence_issue_id_fkey';
            columns: ['issue_id'];
            isOneToOne: false;
            referencedRelation: 'public_civic_issues';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_intervention_evidence_initiative_id_fkey';
            columns: ['initiative_id'];
            isOneToOne: false;
            referencedRelation: 'public_community_initiatives';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_intervention_evidence_submitted_by_fkey';
            columns: ['submitted_by'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_intervention_evidence_verified_by_fkey';
            columns: ['verified_by'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      public_issue_followups: {
        Row: {
          id: string;
          issue_id: string;
          checked_by: string | null;
          checked_at: string;
          recurrence_detected: boolean;
          observations: string;
          evidence_path: string | null;
        };
        Insert: {
          id?: string;
          issue_id: string;
          checked_by?: string | null;
          checked_at?: string;
          recurrence_detected?: boolean;
          observations: string;
          evidence_path?: string | null;
        };
        Update: {
          id?: string;
          issue_id?: string;
          checked_by?: string | null;
          checked_at?: string;
          recurrence_detected?: boolean;
          observations?: string;
          evidence_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'public_issue_followups_issue_id_fkey';
            columns: ['issue_id'];
            isOneToOne: false;
            referencedRelation: 'public_civic_issues';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_issue_followups_checked_by_fkey';
            columns: ['checked_by'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_coordinator: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
