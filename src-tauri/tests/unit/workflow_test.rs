// Unit tests for workflow step executions

use unhireable_lib::applicator::workflow::{WorkflowStep, WorkflowStepType};
use serde_json::json;
use std::collections::HashMap;

fn create_config_from_json(value: serde_json::Value) -> HashMap<String, serde_json::Value> {
    value.as_object().unwrap().iter().map(|(k, v)| (k.clone(), v.clone())).collect()
}

#[test]
fn test_workflow_step_navigate_config() {
    let step = WorkflowStep {
        id: "navigate_1".to_string(),
        step_type: WorkflowStepType::Navigate,
        config: create_config_from_json(json!({
            "url": "https://example.com/jobs"
        })),
        next_step_id: None,
        failure_step_id: None,
        retry_config: None,
        timeout_secs: None,
    };

    assert_eq!(step.id, "navigate_1");
    assert!(matches!(step.step_type, WorkflowStepType::Navigate));
}

#[test]
fn test_workflow_step_fill_form_config() {
    let step = WorkflowStep {
        id: "fill_form_1".to_string(),
        step_type: WorkflowStepType::FillForm,
        config: create_config_from_json(json!({
            "fields": {
                "name": "{{profile.name}}",
                "email": "{{profile.email}}"
            }
        })),
        next_step_id: None,
        failure_step_id: None,
        retry_config: None,
        timeout_secs: None,
    };

    assert_eq!(step.id, "fill_form_1");
    assert!(matches!(step.step_type, WorkflowStepType::FillForm));
}

#[test]
fn test_workflow_step_click_config() {
    let step = WorkflowStep {
        id: "click_1".to_string(),
        step_type: WorkflowStepType::Click,
        config: create_config_from_json(json!({
            "selector": "button.submit"
        })),
        next_step_id: None,
        failure_step_id: None,
        retry_config: None,
        timeout_secs: None,
    };

    assert_eq!(step.id, "click_1");
    assert!(matches!(step.step_type, WorkflowStepType::Click));
}

#[test]
fn test_workflow_step_verify_config() {
    let step = WorkflowStep {
        id: "verify_1".to_string(),
        step_type: WorkflowStepType::Verify,
        config: create_config_from_json(json!({
            "type": "element_exists",
            "selector": ".success-message"
        })),
        next_step_id: None,
        failure_step_id: None,
        retry_config: None,
        timeout_secs: None,
    };

    assert_eq!(step.id, "verify_1");
    assert!(matches!(step.step_type, WorkflowStepType::Verify));
}

#[test]
fn test_workflow_step_wait_config() {
    let step = WorkflowStep {
        id: "wait_1".to_string(),
        step_type: WorkflowStepType::Wait,
        config: create_config_from_json(json!({
            "duration_ms": 2000
        })),
        next_step_id: None,
        failure_step_id: None,
        retry_config: None,
        timeout_secs: None,
    };

    assert_eq!(step.id, "wait_1");
    assert!(matches!(step.step_type, WorkflowStepType::Wait));
}

#[test]
fn test_workflow_step_execute_script_config() {
    let step = WorkflowStep {
        id: "script_1".to_string(),
        step_type: WorkflowStepType::ExecuteScript,
        config: create_config_from_json(json!({
            "script": "document.querySelector('button').click();"
        })),
        next_step_id: None,
        failure_step_id: None,
        retry_config: None,
        timeout_secs: None,
    };

    assert_eq!(step.id, "script_1");
    assert!(matches!(step.step_type, WorkflowStepType::ExecuteScript));
}

#[test]
fn test_workflow_step_condition_config() {
    let step = WorkflowStep {
        id: "condition_1".to_string(),
        step_type: WorkflowStepType::Condition,
        config: create_config_from_json(json!({
            "expression": "document.querySelector('.error') === null",
            "on_true": "continue",
            "on_false": "retry"
        })),
        next_step_id: None,
        failure_step_id: None,
        retry_config: None,
        timeout_secs: None,
    };

    assert_eq!(step.id, "condition_1");
    assert!(matches!(step.step_type, WorkflowStepType::Condition));
}

